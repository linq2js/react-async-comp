import {
  ReactNode,
  isValidElement,
  memo,
  useCallback,
  useLayoutEffect,
  useState,
} from "react";
import {
  AnyFunc,
  LoaderContext,
  RAC,
  RACOptions,
  RACPropsBase,
  RenderContext,
  SerializableProps,
  Store,
} from "./types";
import { isPlainObject, isPromiseLike } from "./utils";
import { createListenable } from "./listenable";
import { createCache, getCache, removeCache } from "./cache";

export type CreateRAC = {
  <TProps extends RACPropsBase = {}>(
    render: (
      props: TProps,
      context: LoaderContext
    ) => ReactNode | Promise<ReactNode>,
    options?: RACOptions
  ): RAC<TProps, ReactNode>;

  <
    TData,
    TProps extends {},
    TSerializableProps extends SerializableProps<TProps>
  >(
    loader: (
      props: TSerializableProps,
      context: LoaderContext
    ) => TData | Promise<TData>,
    render: (props: TProps, context: RenderContext<TData>) => ReactNode,
    options?: RACOptions
  ): RAC<TProps, TData>;
};

export const rac: CreateRAC = (loader: AnyFunc, ...args: any[]) => {
  let render: AnyFunc | undefined;
  let options: RACOptions | undefined;
  const onCleanup = createListenable();
  let shouldSerialize = true;

  if (typeof args[0] === "function") {
    [render, options] = args;
  } else {
    [options] = args;
  }

  const { dispose = "unused" } = options || {};
  const cacheKey = loader;

  const use = (props: any, render?: AnyFunc) => {
    const { children: _children, ...serializableProps } = props;
    const cache = load(serializableProps);
    if (cache.loading) {
      throw cache.result;
    }

    if (cache.error) {
      throw cache.error;
    }

    const setState = useState({})[1];
    const rerender = useCallback(() => setState({}), [setState]);

    useLayoutEffect(() => {
      return cache.subscribe(rerender);
    }, [cache, rerender]);

    if (render) {
      const revalidate = useCallback(() => {
        cache.dispose();
        rerender();
      }, [cache]);

      const renderContext: RenderContext<any> = {
        revalidate,
        revalidateAll: cache.revalidateAll,
        data: cache.data,
      };

      return render(props, renderContext);
    }

    return cache.data;
  };

  const fc = (props: any): any => {
    return use(props, render);
  };

  const load = (props: any) => {
    const items = getCache(cacheKey);
    const propsKey = shouldSerialize ? serializeProps(props) : "";
    let cache = items.get(propsKey);
    if (!cache) {
      const [newCache, updateCache] = createCache(
        cacheKey,
        propsKey,
        dispose,
        onCleanup.notifyAndClear
      );

      cache = newCache;

      try {
        const loaderContext: LoaderContext = {
          revalidateAll: cache.revalidateAll,
          use(storeOrEffect: Store<any> | AnyFunc, equal: AnyFunc = Object.is) {
            // is effect
            if (typeof storeOrEffect === "function") {
              const effect = storeOrEffect;

              cache?.onReady(() => {
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

              cache?.onReady(() => {
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
          updateCache("promise", result);
        } else {
          updateCache("data", result);
        }
      } catch (error) {
        updateCache("error", error);
      }

      items.set(propsKey, cache);
    }

    return cache;
  };

  return Object.assign(memo(fc), {
    clear() {
      removeCache(cacheKey, (item) => item.dispose());
    },
    revalidateAll() {
      getCache(cacheKey).forEach((item) => item.revalidateAll());
    },
    get(props: any) {
      return load(props).result;
    },
    use(props: any) {
      return use(props);
    },
    set(value: any, props: any = {}) {
      const propsKey = serializeProps(props);
      const cache = getCache(cacheKey).get(propsKey);
      if (!cache) return false;
      cache.update(value);
      return true;
    },
  });
};

export const select = <TState, TResult>(
  from: Store<TState>,
  selector: (state: TState) => TResult
): Store<TResult> => {
  return {
    ...from,
    getState() {
      return selector(from.getState());
    },
  };
};

const serializeProps = (props: any = {}) => {
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
          .sort()
          .map((key) => `${JSON.stringify(key)}:${serialize(value[key])}`)
          .join(",");
      }

      return "#I";
    }

    return JSON.stringify(value);
  };

  return serialize(props);
};

export const from = <TData, TProps extends RACPropsBase | void = void>(
  loader: (payload: TProps) => TData
) => {
  return {
    get(props: TProps) {
      return getCache(loader).get(serializeProps(props))?.result;
    },
    set(
      value: TData | ((prev: TData) => TData),
      props: {} extends TProps ? void : TProps
    ) {
      getCache(loader).get(serializeProps(props))?.update(value);
    },
  };
};
