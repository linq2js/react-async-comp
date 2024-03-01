import { createListenable } from "./listenable";
import { AnyFunc, DisposeOption } from "./types";

type RACCache = {
  readonly result: Promise<any>;
  readonly data?: any;
  readonly loading: boolean;
  readonly error?: any;
  dispose(): void;
  revalidateAll(): void;
  onReady(listener: VoidFunction): void;
  subscribe(listener: VoidFunction): VoidFunction;
  update(value: any): void;
};

let allCache = new WeakMap<any, Map<string, RACCache>>();

export const createCache = (
  cacheKey: AnyFunc,
  key: string,
  disposeWhen: DisposeOption,
  cleanup: VoidFunction
) => {
  let data: any;
  let error: any;
  let result: Promise<any> | undefined;
  let loading = false;
  let cache: RACCache;
  let autoDisposeTimerId: any;
  let removed = false;
  const onReady = createListenable();
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

    const items = allCache.get(cacheKey);

    if (items) {
      const c = items.get(key);
      if (c === cache) {
        items.delete(key);
      }
      if (!items.size) {
        allCache.delete(cacheKey);
      }
    }

    onReady.clear();

    cleanup?.();
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
    get result() {
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
    subscribe: onRevalidate.subscribe,
    update(value) {
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

  return [
    cache,
    // cache updater
    setResult,
  ] as const;
};

export const getCache = (key: AnyFunc) => {
  let items = allCache.get(key);

  if (!items) {
    items = new Map();
    allCache.set(key, items);
  }

  return items;
};

export const removeCache = (
  key: AnyFunc,
  callback?: (item: RACCache) => void
) => {
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
