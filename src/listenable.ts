export const createListenable = <T = void>(
  options: {
    onSubscribe?: VoidFunction;
    onUnsubscribe?: VoidFunction;
  } = {}
) => {
  const listeners = new Set<(args: T) => void>();

  return {
    get size() {
      return listeners.size;
    },
    clear() {
      listeners.clear();
    },
    notify(args: T) {
      listeners.forEach((listener) => listener(args));
    },
    notifyAndClear(args: T) {
      const copy = Array.from(listeners);
      listeners.clear();
      copy.forEach((listener) => listener(args));
    },
    subscribe(listener: (args: T) => void) {
      options.onSubscribe?.();
      listeners.add(listener);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        listeners.delete(listener);
        options.onUnsubscribe?.();
      };
    },
  };
};
