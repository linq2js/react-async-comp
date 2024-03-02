import { ReactNode, memo, useCallback, useLayoutEffect, useState } from "react";
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

    useLayoutEffect(() => {
      return cache.onUpdate(rerender);
    }, [cache, rerender]);

    return cache;
  };

  const fc = (props: any): any => {
    const cache = use(props);

    if (!render) return cache.data;

    const renderContext: RenderContext<any> = {
      revalidate: cache.revalidate,
      data: cache.data,
      set: cache.set,
    };

    return render(props, renderContext);
  };

  const load = (props: any) => {
    return tryCreate(loader, props, dispose);
  };

  return Object.assign(memo(fc), {
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
