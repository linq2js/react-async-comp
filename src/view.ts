import { ReactNode, memo, useCallback, useLayoutEffect, useState } from "react";
import {
  AnyFunc,
  LoaderContext,
  RenderContext,
  View,
  ViewOptions,
  ViewPropsBase,
  SerializableProps,
  Store,
} from "./types";
import { createCache, getCache, removeCache, getKey } from "./cache";

export type ViewFn = {
  <TProps extends ViewPropsBase = {}>(
    render: (
      props: TProps,
      context: LoaderContext
    ) => ReactNode | Promise<ReactNode>,
    options?: ViewOptions
  ): View<TProps, ReactNode>;

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
    options?: ViewOptions
  ): View<TProps, TData>;
};

export const view: ViewFn = (loader: AnyFunc, ...args: any[]) => {
  let render: AnyFunc | undefined;
  let options: ViewOptions | undefined;

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
      throw cache.get();
    }

    if (cache.error) {
      throw cache.error;
    }

    const setState = useState({})[1];
    const rerender = useCallback(() => setState({}), [setState]);

    useLayoutEffect(() => {
      return cache.onUpdate(rerender);
    }, [cache, rerender]);

    if (render) {
      const renderContext: RenderContext<any> = {
        revalidate: cache.revalidate,
        data: cache.data,
        set: cache.set,
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
    const propsKey = getKey(props);
    let cache = items.get(propsKey);

    if (!cache) {
      cache = createCache(cacheKey, props, dispose);
      items.set(propsKey, cache);
    }

    return cache;
  };

  return Object.assign(memo(fc), {
    clear() {
      removeCache(cacheKey, (item) => item.dispose());
    },
    revalidate() {
      getCache(cacheKey).forEach((item) => item.revalidate());
    },
    get(props: any) {
      return load(props).get();
    },
    use(props: any) {
      return use(props);
    },
    set(value: any, props: any = {}) {
      const cache = getCache(cacheKey).get(getKey(props));
      if (!cache) return false;
      cache.set(value);
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
