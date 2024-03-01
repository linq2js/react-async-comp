import { isValidElement } from "react";
import { createListenable } from "./listenable";
import { AnyFunc, DisposeOption, LoaderContext, Store } from "./types";
import { isPlainObject, isPromiseLike } from "./utils";

type Cache = {
  readonly data?: any;
  readonly loading: boolean;
  readonly error?: any;
  dispose(): void;
  revalidateAll(): void;
  onReady(listener: VoidFunction): void;
  onUpdate(listener: VoidFunction): VoidFunction;
  get(): Promise<any>;
  set(value: any): void;
};

let allCache = new WeakMap<any, Map<string, Cache>>();

export const createCache = (
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
  const onRevalidate = createListenable({
    onSubscribe() {
      clearTimeout(autoDisposeTimerId);
    },
    onUnsubscribe() {
      if (disposeWhen === "unused") {
        if (!onRevalidate.size) {
          remove();
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
    if (type === "data") {
      result = Promise.resolve(value);
      const changed = data !== value;
      data = value;
      onReady.notifyAndClear();
      return changed;
    }

    if (type === "error") {
      result = Promise.reject(error);
      const changed = error !== value;
      error = value;
      onReady.notifyAndClear();
      return changed;
    }

    result = value as Promise<any>;
    loading = true;

    const r = result;

    result
      .then(
        (resolved) => {
          if (r !== result) return;
          data = resolved;
          loading = false;
        },
        (rejected) => {
          if (r !== result) return;
          error = rejected;
          loading = false;
        }
      )
      .finally(() => {
        if (r !== result) return;
        if (disposeWhen === "unused") {
          autoDisposeTimerId = setTimeout(remove, 100);
        }
        onReady.notifyAndClear();
      });

    return true;
  };

  cache = {
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
    revalidateAll() {
      remove();
      onRevalidate.notifyAndClear();
    },
    onUpdate: onRevalidate.subscribe,
    set(value) {
      let changed = false;

      if (typeof value === "function") {
        if (loading) {
          setResult("promise", resultReady().then(value));
        }
        try {
          const next = value(data);
          if (next !== data) {
            changed = setResult("data", next);
          }
        } catch (ex) {
          changed = setResult("error", ex);
        }
      } else {
        changed = setResult("data", value);
      }

      if (changed) {
        onRevalidate.notify();
      }
    },
  };

  try {
    const loaderContext: LoaderContext = {
      revalidateAll: cache.revalidateAll,
      use(storeOrEffect: Store<any> | AnyFunc, equal: AnyFunc = Object.is) {
        // is effect
        if (typeof storeOrEffect === "function") {
          const effect = storeOrEffect;

          onReady.subscribe(() => {
            const emit = () => {
              cache?.revalidateAll();
            };
            const unsubscribe = effect(emit);
            if (typeof unsubscribe === "function") {
              onCleanup.subscribe(unsubscribe);
            }
          });
        } else {
          // is store
          const store = storeOrEffect;
          let current = store.getState();

          onReady.subscribe(() => {
            onCleanup.subscribe(
              store.subscribe(() => {
                const next = store.getState();
                if (equal(next, current)) return;
                cache?.revalidateAll();
              })
            );
          });

          return current;
        }
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

export const getCache = (key: AnyFunc) => {
  let items = allCache.get(key);

  if (!items) {
    items = new Map();
    allCache.set(key, items);
  }

  return items;
};

export const removeCache = (key: AnyFunc, callback?: (item: Cache) => void) => {
  if (callback) {
    const items = allCache.get(key);
    items?.forEach(callback);
  } else {
    allCache.delete(key);
  }
};

export const clearCache = () => {
  allCache = new WeakMap();
};

export const from = <TData, TProps extends {} | void = {}>(
  loader: (payload: TProps) => TData
) => {
  return {
    get(props: TProps) {
      return getCache(loader).get(getKey(props))?.get();
    },
    set(
      value: TData | ((prev: TData) => TData),
      props: {} extends TProps ? void : TProps
    ) {
      getCache(loader).get(getKey(props))?.set(value);
    },
  };
};

const isNil = (value: any) => {
  if (value === null) return false;
  if (typeof value === "undefined") return false;
  if (typeof value === "number" && isNaN(value)) return false;
  return true;
};

const cachedKeys = new WeakMap<object, string>();

export const getKey = (props: any = {}) => {
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
        return Object.keys(value)
          .filter((key) => !isNil(value[key]))
          .sort()
          .map((key) => `${JSON.stringify(key)}:${serialize(value[key])}`)
          .join(",");
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
