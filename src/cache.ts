import { isValidElement } from "react";
import { createListenable } from "./listenable";
import {
  AnyFunc,
  DisposeOption,
  Cache as CacheAPI,
  LoaderContext,
  Store,
  Effect,
  Equal,
  Loader,
} from "./types";
import { isPlainObject, isPromiseLike } from "./utils";

type Cache = {
  readonly key: string;
  readonly data?: any;
  readonly loading: boolean;
  readonly error?: any;
  readonly removed: boolean;
  readonly name: string | undefined;
  dispose(): void;
  revalidate(): void;
  onReady(listener: VoidFunction): void;
  onUpdate(listener: VoidFunction): VoidFunction;
  get(): Promise<any>;
  set(value: any): void;
};

let allCache = new WeakMap<AnyFunc, Map<string, Cache>>();

export const tryCreate = (
  loader: AnyFunc,
  props: any,
  disposeWhen: DisposeOption
) => {
  const group = getCache(loader);
  const key = getKey(props);
  let item = group.get(key);
  if (!item) {
    item = create(loader, props, disposeWhen);
    group.set(key, item);
  }
  return item;
};

export const create = (
  loader: AnyFunc,
  props: any,
  disposeWhen: DisposeOption
) => {
  let data: any;
  let error: any;
  let result: Promise<any> | undefined;
  let loading = false;
  let cache: Cache;
  let autoDisposeTimerId: any;
  let removed = false;
  const propsKey = getKey(props);
  const onReady = createListenable();
  const onCleanup = createListenable();
  const onChange = createListenable({
    onSubscribe() {
      clearTimeout(autoDisposeTimerId);
    },
    onUnsubscribe() {
      if (disposeWhen === "unused") {
        if (!onChange.size) {
          clearTimeout(autoDisposeTimerId);
          autoDisposeTimerId = setTimeout(remove, 0);
        }
      }
    },
  });

  const remove = () => {
    if (removed) {
      return;
    }

    removed = true;

    const items = allCache.get(loader);

    if (items) {
      const c = items.get(propsKey);
      if (c === cache) {
        items.delete(propsKey);
      }
      if (!items.size) {
        allCache.delete(loader);
      }
    }

    onReady.clear();
    onCleanup.notifyAndClear();
  };

  const resultReady = () => {
    if (!result) {
      throw new Error("The cache is not ready yet");
    }
    return result;
  };

  const setResult = (type: "promise" | "data" | "error", value: unknown) => {
    clearTimeout(autoDisposeTimerId);

    const isReady = !!result;
    if (type === "data") {
      result = Promise.resolve(value);
      const changed = data !== value;
      data = value;
      onReady.notifyAndClear();
      if (isReady && changed) {
        onChange.notify();
      }
      return;
    }

    if (type === "error") {
      result = Promise.reject(error);
      const changed = error !== value;
      error = value;
      onReady.notifyAndClear();
      if (isReady && changed) {
        onChange.notify();
      }
      return;
    }

    result = value as Promise<any>;
    loading = true;
    data = undefined;

    const r = result;
    const handleReady = () => {
      clearTimeout(autoDisposeTimerId);
      if (disposeWhen === "unused") {
        autoDisposeTimerId = setTimeout(remove, 100);
      }
      onReady.notifyAndClear();
    };

    result.then(
      (value) => {
        if (r !== result) return;
        data = value;
        loading = false;
        handleReady();
      },
      (reason) => {
        if (r !== result) return;
        error = reason;
        loading = false;
        handleReady();
      }
    );

    if (isReady) {
      onChange.notify();
    }
  };

  cache = {
    key: propsKey,
    name: loader.name,
    get removed() {
      return removed;
    },
    get() {
      return resultReady();
    },
    get data() {
      return data;
    },
    get error() {
      return error;
    },
    get loading() {
      return loading;
    },
    onReady: onReady.subscribe,
    dispose: remove,
    revalidate() {
      remove();
      onChange.notifyAndClear();
    },
    onUpdate: onChange.subscribe,
    set(value) {
      if (typeof value === "function") {
        if (loading) {
          setResult("promise", resultReady().then(value));
        } else {
          try {
            setResult("data", value(data));
          } catch (ex) {
            setResult("error", ex);
          }
        }
      } else {
        setResult("data", value);
      }
    },
  };

  const enqueue = (effect: () => void | VoidFunction) => {
    onReady.subscribe(() => {
      const result = effect();
      if (typeof result === "function") {
        onCleanup.subscribe(result);
      }
    });
  };

  try {
    const loaderContext: LoaderContext = {
      revalidate: cache.revalidate,
      use(...args: any[]) {
        // is effect
        if (typeof args[0] === "function") {
          const effect = args[0] as Effect;

          enqueue(() => {
            const emit = () => {
              cache.revalidate();
            };
            return effect(emit);
          });

          return;
        }

        if (!args[0] || typeof args[0] !== "object") {
          throw new Error(`Unsupported overload use(${args})`);
        }

        // is store
        if ("getState" in args[0]) {
          // is store
          const [store, equal = Object.is] = args as [
            Store<any>,
            Equal | undefined
          ];
          let current = store.getState();

          enqueue(() =>
            store.subscribe(() => {
              const next = store.getState();
              if (equal(next, current)) return;
              cache.revalidate();
            })
          );

          return current;
        }

        // is cache
        const dependency = args[0] as CacheAPI<any, any>;
        const result = dependency.load(args[1]);

        enqueue(() => {
          const variant = getCacheVariant(dependency.loader, args[1]);
          return variant?.onUpdate(() => {
            cache.revalidate();
          });
        });

        return result;
      },
    };

    const result = loader(props, loaderContext);

    if (isPromiseLike(result)) {
      setResult("promise", result);
    } else {
      setResult("data", result);
    }
  } catch (error) {
    setResult("error", error);
  }

  return cache;
};

const getCacheVariant = (loader: AnyFunc, props: any) => {
  const cache = getCache(loader);
  const variant = cache.get(getKey(props));
  return variant;
};

const getCache = (key: AnyFunc) => {
  let items = allCache.get(key);

  if (!items) {
    items = new Map();
    allCache.set(key, items);
  }

  return items;
};

export const removeCache = (
  loader: AnyFunc,
  callback?: (item: Cache) => void
) => {
  if (callback) {
    const items = allCache.get(loader);
    if (items) {
      items.forEach(callback);
      items.clear();
    }
  } else {
    allCache.delete(loader);
  }
};

export const clearAllCache = () => {
  allCache = new WeakMap();
};

export const cache = <TData, TProps extends {} | void = {}>(
  loader: Loader<TData, TProps>
): CacheAPI<TData, TProps> => {
  return {
    loader,
    revalidate() {
      getCache(loader).forEach((item) => item.revalidate());
    },
    clear() {
      getCache(loader).forEach((item) => item.dispose());
    },
    load(props) {
      return tryCreate(loader, props, "unused").get();
    },
    get(props) {
      return getCacheVariant(loader, props)?.get();
    },
    set(value, props) {
      getCacheVariant(loader, props)?.set(value);
    },
  };
};

const isNil = (value: any) => {
  return (
    value === null ||
    typeof value === "undefined" ||
    (typeof value === "number" && isNaN(value))
  );
};

const cachedKeys = new WeakMap<object, string>();

const getKey = (props: any = {}) => {
  const canCache = props && typeof props === "object";

  if (canCache) {
    // Mark the object as immutable; without this, caching would be ineffective.
    Object.seal(props);
    Object.freeze(props);
    const key = cachedKeys.get(props);
    if (typeof key === "string") return key;
  }

  const serialize = (value: unknown): string => {
    if (!value) {
      if (typeof value === "undefined") {
        return "#U";
      }
      if (value === null) {
        return "#N";
      }
      if (value === "") {
        return "#E";
      }
      return String(value);
    }

    if (value instanceof Date) {
      return `D:${value.getTime()}`;
    }

    if (value instanceof RegExp) {
      return `R:${value}`;
    }

    if (Array.isArray(value)) {
      return value.map(serialize).join(",");
    }

    if (typeof value === "object") {
      if (isPlainObject(value) && !isValidElement(value)) {
        const pairs: string[] = [];
        const sortedKeys = Object.keys(value)
          .filter((key) => !isNil(value[key]))
          .sort();

        for (const key of sortedKeys) {
          const valueStr = serialize(value[key]);
          if (!valueStr) continue;
          pairs.push(`${JSON.stringify(key)}:${valueStr}`);
        }

        if (!pairs.length) {
          return "";
        }

        return `{${pairs.join(",")}}`;
      }

      return "#I";
    }

    return JSON.stringify(value);
  };

  const key = serialize(props);

  if (canCache) {
    cachedKeys.set(props, key);
  }

  return key;
};
