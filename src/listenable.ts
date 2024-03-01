export const createListenable = <T = void>(
  options: {
    onSubscribe?: VoidFunction;
    onUnsubscribe?: VoidFunction;
  } = {}
) => {
  type Listener = (args: T) => void;

  const listeners: Listener[] = [];

  return {
    get size() {
      return listeners.length;
    },
    clear() {
      listeners.splice(0, listeners.length);
    },
    notify(args: T) {
      listeners.slice().forEach((listener) => listener(args));
    },
    notifyAndClear(args: T) {
      listeners
        .splice(0, listeners.length)
        .forEach((listener) => listener(args));
    },
    subscribe(listener: (args: T) => void) {
      options.onSubscribe?.();

      listeners.push(listener);

      let active = true;

      return () => {
        if (!active) return;
        active = false;
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
        options.onUnsubscribe?.();
      };
    },
  };
};
