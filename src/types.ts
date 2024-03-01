import { FunctionComponent } from "react";

export type AnyFunc = (...args: any[]) => any;

export type NoInfer<T> = [T][T extends any ? 0 : never];

export type Equal<T = any> = (a: T, b: T) => boolean;

export type DisposeOption = "never" | "unused";

export type Effect = (emit: VoidFunction) => void | VoidFunction;

export type RACPropsBase = Record<string, RACPropType>;

export type RACPropType =
  | undefined
  | null
  | Date
  | string
  | number
  | { [key: string | number]: RACPropType };

export type RACOptions = {
  dispose?: DisposeOption;
};

export type LoaderContext = {
  revalidateAll(): void;
  use<T>(store: Store<T>, equal?: NoInfer<Equal<T>>): T;
  use(effect: Effect): void;
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

export type RAC<TProps, TData> = FunctionComponent<TProps> & {
  clear(): void;
  revalidateAll(): void;
  get(props: TProps): Promise<TData>;
  use(props: TProps): TData;
  set(
    reducer: (prev: TData) => TData,
    props: {} extends SerializableProps<TProps> ? void : TProps
  ): boolean;
  set(
    value: TData,
    props: {} extends SerializableProps<TProps> ? void : TProps
  ): boolean;
};
