import type { ClientToServerEvents, ServerToClientEvents } from "@cmux/shared";

type EventHandler = (...args: unknown[]) => void;

type ErrorLike = {
  message?: unknown;
  cause?: unknown;
};

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (
      typeof error.message === "string" &&
      error.message.length > 0 &&
      !error.message.includes("[object Object]")
    ) {
      return error.message;
    }
    const cause = (error as ErrorLike).cause;
    if (cause && cause !== error) {
      return extractErrorMessage(cause);
    }
  }
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  if (error && typeof error === "object") {
    const message = (error as ErrorLike).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
};

export class CmuxIpcSocketClient {
  private handlers = new Map<string, Set<EventHandler>>();
  public connected = false;
  public disconnected = true;
  public id = "cmux-ipc";
  private disposed = false;

  constructor(private readonly query: Record<string, string>) {}

  async connect() {
    if (this.connected) return this;
    await window.cmux.register({
      auth: this.query.auth,
      team: this.query.team,
      auth_json: this.query.auth_json,
    });
    this.connected = true;
    this.disconnected = false;

    // Wire existing handlers to IPC events
    this.handlers.forEach((_set, event) => {
      window.cmux.on(event, (...args: unknown[]) => this.trigger(event, ...args));
    });
    this.trigger("connect");
    return this;
  }

  disconnect() {
    if (this.disposed) return this;
    this.disposed = true;
    this.connected = false;
    this.disconnected = true;
    this.trigger("disconnect");
    return this;
  }

  on<E extends keyof ServerToClientEvents>(
    event: E | string,
    handler: ServerToClientEvents[E] | EventHandler
  ) {
    const key = String(event);
    if (!this.handlers.has(key)) this.handlers.set(key, new Set());
    this.handlers.get(key)!.add(handler as EventHandler);
    // Subscribe to IPC if connected
    window.cmux.on(key, (...args: unknown[]) => this.trigger(key, ...args));
    return this;
  }
  //window.api.cmux

  off<E extends keyof ServerToClientEvents>(
    event?: E | string,
    handler?: ServerToClientEvents[E] | EventHandler
  ) {
    if (!event) {
      this.handlers.clear();
      return this;
    }
    const key = String(event);
    if (!handler) {
      this.handlers.delete(key);
    } else {
      this.handlers.get(key)?.delete(handler as EventHandler);
    }
    return this;
  }

  emit<E extends keyof ClientToServerEvents>(
    event: E | string,
    ...args: unknown[]
  ) {
    const key = String(event);
    const last = args[args.length - 1];
    if (typeof last === "function") {
      const cb = last as (result?: unknown) => void;
      const data = args.slice(0, -1);
      window.cmux
        .rpc(key, ...data)
        .then((res: unknown) => cb(res))
        .catch((err: unknown) =>
          cb({ error: extractErrorMessage(err) })
        );
    } else {
      void window.cmux.rpc(key, ...args);
    }
    return this;
  }

  private trigger(event: string, ...args: unknown[]) {
    const set = this.handlers.get(event);
    if (!set) return;
    set.forEach((fn) => fn(...args));
  }
}

// Narrow type cast to satisfy consumers expecting a Socket.IO-like API
// No additional exported types needed; consumers cast to their desired socket type.
