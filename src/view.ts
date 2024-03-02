"use client";

import {
  ReactNode,
  createElement,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  AnyFunc,
  LoaderContext,
  RenderContext,
  View,
  ViewOptions,
  ViewPropsBase,
  Serializable,
  Store,
} from "./types";
import { cache, tryCreate } from "./cache";

export type DataProviderOptions = { name?: string };

export type ViewFn = {
  <TProps extends ViewPropsBase = {}>(
    render: (
      props: TProps,
      context: LoaderContext
    ) => ReactNode | Promise<ReactNode>,
    options?: ViewOptions
  ): View<TProps, ReactNode>;

  <TData, TProps extends {}, TSerializableProps extends Serializable<TProps>>(
    loader: (
      props: TSerializableProps,
      context: LoaderContext
    ) => TData | Promise<TData>,
    render: (props: TProps, context: RenderContext<TData>) => ReactNode,
    options?: ViewOptions
  ): View<TProps, TData>;
};

const createStableCallback = (callback: AnyFunc) => {
  const result = {
    current: callback,
    stable(...args: any[]) {
      return result.current(...args);
    },
  };
  return result;
};

const createPropsProxy = <T extends Record<string | symbol | number, any>>(
  props: T,
  callbackCache: Map<
    string | number | symbol,
    { current: AnyFunc; stable: AnyFunc }
  >
) => {
  return new Proxy(props, {
    get(_, prop) {
      const value = props[prop];
      if (typeof value === "function") {
        let cached = callbackCache.get(prop);
        if (!cached) {
          cached = createStableCallback(value);
          callbackCache.set(prop, cached);
        } else {
          cached.current = value;
        }
        return cached.stable;
      }

      return value;
    },
    set() {
      return false;
    },
  });
};

const isClientSide = typeof window !== "undefined";

export const view: ViewFn = Object.assign((loader: AnyFunc, ...args: any[]) => {
  if (!isClientSide) {
    return null as any;
  }

  let render: AnyFunc | undefined;
  let options: ViewOptions | undefined;

  if (typeof args[0] === "function") {
    [render, options] = args;
  } else {
    [options] = args;
  }

  const { dispose = "unused" } = options || {};
  const cacheKey = loader;

  const use = (props: any) => {
    const { children: _children, ...serializableProps } = props;
    const cache = load(serializableProps);
    if (cache.loading) {
      throw cache.get();
    }

    if (cache.error) {
      throw cache.error;
    }

    const setState = useState({})[1];
    const rerender = useCallback(() => setState({}), [setState]);

    useEffect(() => {
      return cache.onUpdate(rerender);
    }, [cache, rerender]);

    return cache;
  };

  const fc = memo(
    forwardRef((props: any, ref): any => {
      const cache = use(props);

      if (!render) return cache.data;

      const renderContext: RenderContext<any> = {
        revalidate: cache.revalidate,
        data: cache.data,
        set: cache.set,
      };

      return render(ref ? { ...props, ref } : props, renderContext);
    })
  );

  const wrapper = forwardRef((props, ref): any => {
    const callbackMap = useState(() => new Map())[0];
    const proxy = createPropsProxy({ ...props, ref }, callbackMap);
    return createElement(fc, proxy);
  });

  const load = (props: any) => {
    return tryCreate(loader, props, dispose);
  };

  return Object.assign(wrapper, {
    ...cache(loader),
    clear() {
      cache(cacheKey).clear();
    },
    revalidate() {
      cache(cacheKey).revalidate();
    },
    use(props: any) {
      return use(props).data;
    },
  });
}, {});

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
