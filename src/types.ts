import { FunctionComponent } from "react";

export type AnyFunc = (...args: any[]) => any;

export type NoInfer<T> = [T][T extends any ? 0 : never];

export type Equal<T = any> = (a: T, b: T) => boolean;

export type DisposeOption = "never" | "unused";

export type Effect = (emit: VoidFunction) => void | VoidFunction;

export type ViewPropsBase = Record<string, ViewPropType>;

export type SetFn<T> = {
  (data: DataOrRecipe<T>): T;
};

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

export type DynamicCache<TData, TProps extends {} | void = {}> = {
  load(props: MaybeVoid<TProps>): Promise<TData>;
  get(props: MaybeVoid<TProps>): Promise<TData> | undefined;
  set(data: DataOrRecipe<TData>, props: MaybeVoid<TProps>): void;
};

export type View<TProps, TData> = FunctionComponent<TProps> &
  DynamicCache<TData> & {
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
