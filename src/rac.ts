import {
  FunctionComponent,
  ReactNode,
  isValidElement,
  memo,
  useCallback,
  useLayoutEffect,
  useState,
} from "react";
import { AnyFunc, Equal, NoInfer } from "./types";
import { isPlainObject, isPromiseLike } from "./utils";
import { createListenable } from "./listenable";

export type RACPropsBase = Record<string, RACPropType>;

export type RACPropType =
  | undefined
  | null
  | Date
  | string
  | number
  | { [key: string | number]: RACPropType };

type RACContext = {
  readonly result: Promise<any> | undefined;
  readonly data?: any;
  readonly loading: boolean;
  readonly error?: any;
  setResult(type: "promise" | "data" | "error", value: unknown): void;
  dispose(): void;
  revalidateAll(): void;
  onResolved(listener: VoidFunction): void;
  subscribe(listener: VoidFunction): VoidFunction;
};

export type DisposeOption = "never" | "unused";

export type RACOptions = {
  dispose?: DisposeOption;
};

let allRACContexts = new WeakMap<any, Map<string, RACContext>>();

export type LoaderContext = {
  revalidateAll(): void;
  use<T>(store: Store<T>, equal?: NoInfer<Equal<T>>): T;
  use(channel: Channel): void;
};

export type RenderContext<TData> = {
  revalidate(): void;
  revalidateAll(): void;
  data: TData;
};

export type SerializableProps<TProps> = {
  [key in keyof TProps as TProps[key] extends RACPropType
    ? key
    : never]: TProps[key];
};

export type Store<TState> = {
  getState(): TState;
  subscribe(listener: VoidFunction): VoidFunction;
};

export type RAC<TProps> = FunctionComponent<TProps> & {
  dispose(): void;
  revalidateAll(): void;
};

export type CreateRAC = {
  <TProps extends RACPropsBase>(
    render: (
      props: TProps,
      context: LoaderContext
    ) => ReactNode | Promise<ReactNode>,
    options?: RACOptions
  ): RAC<TProps>;

  <TProps, TResult, TSerializableProps extends SerializableProps<TProps>>(
    loader: (
      props: TSerializableProps,
      context: LoaderContext
    ) => TResult | Promise<TResult>,
    render: (props: TProps, context: RenderContext<TResult>) => ReactNode,
    options?: RACOptions
  ): RAC<TProps>;
};

const globalOnRevalidate = createListenable<string[]>();

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
  const contextKey = loader;

  const fc = (props: any): any => {
    const { children: _children, ...serializableProps } = props;
    const context = load(serializableProps);
    if (context.loading) {
      throw context.result;
    }

    if (context.error) {
      throw context.error;
    }

    const setState = useState({})[1];
    const rerender = useCallback(() => setState({}), [setState]);

    useLayoutEffect(() => {
      return context.subscribe(rerender);
    }, [context, rerender]);

    if (render) {
      const revalidate = useCallback(() => {
        context.dispose();
        rerender();
      }, [context]);

      const renderContext: RenderContext<any> = {
        revalidate,
        revalidateAll: context.revalidateAll,
        data: context.data,
      };

      return render(props, renderContext);
    }

    return context.data;
  };

  const load = (props: any) => {
    let items = allRACContexts.get(contextKey);
    if (!items) {
      items = new Map();
      allRACContexts.set(contextKey, items);
    }
    const propsKey = shouldSerialize ? serializeProps(props) : "";
    let context = items.get(propsKey);
    if (!context) {
      context = createContext(
        contextKey,
        propsKey,
        dispose,
        onCleanup.notifyAndClear
      );

      try {
        const loaderContext: LoaderContext = {
          revalidateAll: context.revalidateAll,
          use(
            storeOrChannel: Store<any> | AnyFunc,
            equal: AnyFunc = Object.is
          ) {
            // is channel
            if (typeof storeOrChannel === "function") {
              const channel = storeOrChannel;

              context?.onResolved(() => {
                const unsubscribe = channel(() => {
                  context?.revalidateAll();
                });
                if (typeof unsubscribe === "function") {
                  onCleanup.subscribe(unsubscribe);
                }
              });
            } else {
              // is store
              const store = storeOrChannel;
              let current = store.getState();

              context?.onResolved(() => {
                onCleanup.subscribe(
                  store.subscribe(() => {
                    const next = store.getState();
                    if (equal(next, current)) return;
                    context?.revalidateAll();
                  })
                );
              });

              return current;
            }
          },
        };
        const result = loader(props, loaderContext);

        if (isPromiseLike(result)) {
          context.setResult("promise", result);
        } else {
          context.setResult("data", result);
        }
      } catch (error) {
        context.setResult("error", error);
      }

      items.set(propsKey, context);
    }

    return context;
  };

  return Object.assign(memo(fc), {
    dispose() {
      const items = allRACContexts.get(contextKey);
      items?.forEach((item) => item.dispose());
      allRACContexts.delete(contextKey);
    },
    revalidateAll() {
      const items = allRACContexts.get(contextKey);
      items?.forEach((item) => item.revalidateAll());
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

const createContext = (
  contextKey: AnyFunc,
  key: string,
  disposeWhen: DisposeOption,
  cleanup: VoidFunction
) => {
  let data: any;
  let error: any;
  let result: Promise<any> | undefined;
  let loading = false;
  let context: RACContext;
  let autoDisposeTimerId: any;
  const onResolved = createListenable();
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
    const items = allRACContexts.get(contextKey);

    if (items) {
      const c = items.get(key);
      if (c === context) {
        items.delete(key);
      }
      if (!items.size) {
        allRACContexts.delete(contextKey);
      }
    }

    cleanup?.();
  };

  context = {
    get result() {
      return result;
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
    onResolved: onResolved.subscribe,
    setResult(type, value) {
      if (type === "data") {
        result = Promise.resolve(value);
        data = value;
        onResolved.notifyAndClear();
      } else if (type === "error") {
        result = Promise.reject(error);
        error = value;
      } else {
        result = value as Promise<any>;
        loading = true;

        result
          .then(
            (resolved) => {
              data = resolved;
              loading = false;
              onResolved.notifyAndClear();
            },
            (rejected) => {
              error = rejected;
              loading = false;
            }
          )
          .finally(() => {
            if (disposeWhen === "unused") {
              autoDisposeTimerId = setTimeout(remove, 100);
            }
          });
      }
    },
    dispose: remove,
    revalidateAll() {
      remove();
      onRevalidate.notifyAndClear();
    },
    subscribe: onRevalidate.subscribe,
  };

  return context;
};

export const serializeProps = (props: RACPropsBase) => {
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

export const cleanup = () => {
  allRACContexts = new WeakMap();
  globalOnRevalidate.clear();
};

export type Channel = (emit: VoidFunction) => void | VoidFunction;

export type TagFn = {
  (tag: string): Channel;
  (tags: string[]): Channel;
  (filter: (tag: string) => boolean): Channel;
};

export const tag: TagFn = (input) => {
  let matcher: AnyFunc;
  if (typeof input === "function") {
    matcher = input;
  } else if (Array.isArray(input)) {
    const inputTags = input;
    matcher = (tag: string) => inputTags.includes(tag);
  } else {
    matcher = (tag) => tag === input;
  }

  return (emit) => {
    return globalOnRevalidate.subscribe((tags) => {
      if (tags.some(matcher)) {
        emit();
      }
    });
  };
};

export type RevalidateFn = {
  (tag: string): void;

  (tags: string[]): void;
};

export const revalidate: RevalidateFn = (tags) => {
  globalOnRevalidate.notify(Array.isArray(tags) ? tags : [tags]);
};

export const timeout = (ms: number): Channel => {
  return (emit) => {
    const timeoutId = setTimeout(emit, ms);

    return () => {
      clearTimeout(timeoutId);
    };
  };
};
