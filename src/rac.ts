import {
  FunctionComponent,
  ReactNode,
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useState,
} from "react";
import { AnyFunc, Equal } from "./types";
import { isPlainObject, isPromiseLike } from "./utils";

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
  reload(): void;
  subscribe(listener: VoidFunction): VoidFunction;
};

export type StaleOption = "never" | "unused";

export type RACOptions = {
  stale?: StaleOption;
};

let allRACContexts = new WeakMap<any, Map<string, RACContext>>();

export type LoaderContext = {
  reload(): void;
  use<T>(store: Store<T>, equal?: Equal<T>): T;
  use<T>(
    getState: () => T,
    subscribe: (listener: VoidFunction) => VoidFunction,
    equal?: Equal<T>
  ): T;
};

export type RenderContext<TData> = {
  reload(): void;
  reloadAll(): void;
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
  reload(): void;
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

export const rac: CreateRAC = (loader: AnyFunc, ...args: any[]) => {
  let render: AnyFunc | undefined;
  let options: RACOptions | undefined;
  const unsubscribeExternalStores = new Set<VoidFunction>();
  let shouldSerialize = true;

  if (typeof args[0] === "function") {
    [render, options] = args;
  } else {
    [options] = args;
  }

  const { stale = "unused" } = options || {};
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

    useEffect(() => {
      return context.subscribe(rerender);
    }, [context, rerender]);

    if (render) {
      const reload = useCallback(() => {
        context.dispose();
        rerender();
      }, [context]);

      return render(props, {
        reload,
        reloadAll: context.reload,
        data: context.data,
      });
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
      context = createContext(contextKey, propsKey, stale, () => {
        invokeAndClear(unsubscribeExternalStores);
      });

      try {
        const result = loader(props, {
          reload: context.reload,
          get(...args: any[]) {
            let getState: AnyFunc;
            let subscribe: AnyFunc;
            let equal: AnyFunc;

            if (typeof args[0] === "function") {
              [getState, subscribe, equal = Object.is] = args;
            } else {
              [getState, subscribe, equal = Object.is] = [
                args[0].getState,
                args[0].subscribe,
                args[1],
              ];
            }

            let current = getState();
            unsubscribeExternalStores.add(
              subscribe(() => {
                const next = getState();
                if (equal(next, current)) return;
                context?.reload();
              })
            );

            return current;
          },
        });

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
    },
    reload() {
      const items = allRACContexts.get(contextKey);
      items?.forEach((item) => item.reload());
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

const invokeAndClear = (listeners: Set<VoidFunction>) => {
  const copy = Array.from(listeners);
  listeners.clear();
  copy.forEach((listener) => listener());
};

const createContext = (
  contextKey: AnyFunc,
  key: string,
  stale: StaleOption,
  cleanup: VoidFunction
) => {
  let data: any;
  let error: any;
  let result: Promise<any> | undefined;
  let loading = false;
  let context: RACContext;
  let cleanupTimerId: any;
  const listeners = new Set<VoidFunction>();
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
    setResult(type, value) {
      if (type === "data") {
        result = Promise.resolve(value);
        data = value;
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
            },
            (rejectd) => {
              error = rejectd;
              loading = false;
            }
          )
          .finally(() => {
            if (stale === "unused") {
              cleanupTimerId = setTimeout(remove, 100);
            }
          });
      }
    },
    dispose: remove,
    reload() {
      remove();
      invokeAndClear(listeners);
    },
    subscribe(listener) {
      clearTimeout(cleanupTimerId);
      listeners.add(listener);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        listeners.delete(listener);
        if (stale === "unused") {
          if (!listeners.size) {
            remove();
          }
        }
      };
    },
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
};
