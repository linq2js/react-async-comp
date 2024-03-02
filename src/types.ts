import {
  ForwardRefExoticComponent,
  ForwardedRef,
  FunctionComponent,
  PropsWithoutRef,
  RefAttributes,
} from "react";

export type AnyFunc = (...args: any[]) => any;

export type NoInfer<T> = [T][T extends any ? 0 : never];

export type Equal<T = any> = (a: T, b: T) => boolean;

export type DisposeOption = "never" | "unused";

export type Effect = (emit: VoidFunction) => void | VoidFunction;

export type ViewPropsBase = Record<string, ViewPropType>;

export type SetFn<T> = {
  (data: DataOrRecipe<T>): T;
};

export type Loader<T, P extends {} | void = void> = (
  props: P,
  context: LoaderContext
) => T | Promise<T>;

export type ViewPropType =
  | undefined
  | null
  | Date
  | string
  | number
  | { [key: string | number]: ViewPropType };

export type ViewOptions = {
  dispose?: DisposeOption;
};

export type LoaderContext = {
  revalidate(): void;

  use<T>(store: Store<T>, equal?: NoInfer<Equal<T>>): T;

  use(effect: Effect): void;

  use<TData, TProps extends {} | void = {}>(
    cache: Cache<TData, TProps>,
    ...args: void extends MaybeVoid<TProps> ? [] : [props: TProps]
  ): Promise<TData>;
};

export type DataOrRecipe<T> = T | ((prev: T) => T);

export type RenderContext<TData> = {
  revalidate(): void;
  data: TData;
  readonly set: SetFn<TData>;
};

export type Serializable<TProps> = {
  [key in keyof TProps as TProps[key] extends ViewPropType
    ? key
    : never]: TProps[key];
};

export type Store<TState> = {
  getState(): TState;
  subscribe(listener: VoidFunction): VoidFunction;
};

export type MaybeVoid<T> = {} extends Serializable<T> ? void : T;

export type Cache<TData, TProps extends {} | void = {}> = {
  readonly loader: Loader<TData, TProps>;
  revalidate(): void;
  clear(): void;
  load(props: MaybeVoid<TProps>): Promise<TData>;
  get(props: MaybeVoid<TProps>): Promise<TData> | undefined;
  set(data: DataOrRecipe<TData>, props: MaybeVoid<TProps>): void;
};

export type View<TProps extends {}, TData> = ForwardRefExoticComponent<
  PropsWithoutRef<TProps> &
    (TProps extends { ref: ForwardedRef<infer T> } ? RefAttributes<T> : {})
> &
  Cache<TData, TProps> & {
    /**
     * clear all view data
     */
    clear(): void;

    /**
     * revalidate view data, perform view data loader
     */
    revalidate(): void;
    use(props: TProps): TData;
  };
