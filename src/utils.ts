export const isPromiseLike = <T>(value: any): value is Promise<T> => {
  return value && typeof value.then === "function";
};

export const isPlainObject = (
  value: any
): value is Record<string | symbol, any> => {
  if (typeof value !== "object" || value === null) {
    return false; // Not an object or is null
  }

  let proto = Object.getPrototypeOf(value);
  if (proto === null) {
    return true; // `Object.create(null)` case
  }

  let baseProto = proto;
  while (Object.getPrototypeOf(baseProto) !== null) {
    baseProto = Object.getPrototypeOf(baseProto);
  }

  return proto === baseProto;
};

export const delay = (ms = 0) => {
  let timeoutId: any;
  return Object.assign(
    new Promise<void>((resolve) => {
      timeoutId = setTimeout(resolve, ms, true);
    }),
    {
      cancel() {
        clearTimeout(timeoutId);
      },
    }
  );
};
