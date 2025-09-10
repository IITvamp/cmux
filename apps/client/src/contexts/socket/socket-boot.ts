type ResolveFn<T> = (value: T | PromiseLike<T>) => void;
type RejectFn = (reason?: unknown) => void;

function withResolvers<T>() {
  let resolve!: ResolveFn<T>;
  let reject!: RejectFn;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createBootHandle() {
  let state = withResolvers<void>();
  return {
    get promise() {
      return state.promise;
    },
    resolve() {
      // Resolve is idempotent; extra calls are ignored by Promise machinery
      state.resolve();
    },
    reject(reason?: unknown) {
      state.reject(reason);
    },
    reset() {
      state = withResolvers<void>();
    },
  } as const;
}

export const socketBoot = createBootHandle();
