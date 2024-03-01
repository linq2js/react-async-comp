import { createListenable } from "./listenable";
import { AnyFunc, Effect } from "./types";

export type TagFn = {
  (tag: string): Effect;
  (tags: string[]): Effect;
  (filter: (tag: string) => boolean): Effect;
};

const globalEffects = createListenable<string[]>();

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
    return globalEffects.subscribe((tags) => {
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
  globalEffects.notify(Array.isArray(tags) ? tags : [tags]);
};

export const timeout = (ms: number): Effect => {
  return (emit) => {
    const timeoutId = setTimeout(emit, ms);

    return () => {
      clearTimeout(timeoutId);
    };
  };
};

export const clearEffects = () => {
  globalEffects.clear();
};
