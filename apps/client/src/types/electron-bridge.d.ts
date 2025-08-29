declare global {
  interface Window {
    api: {
      cookies: {
        set: (cookie: { name: string; value: string }) => Promise<true>;
      };
    };
  }
}

export {};
