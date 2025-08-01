import { StackClientApp } from "@stackframe/react";
import { useNavigate as useTanstackNavigate } from "@tanstack/react-router";

export const stackClientApp = new StackClientApp({
  // projectId: import.meta.env.VITE_STACK_PROJECT_ID,
  // publishableClientKey: import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY,
  projectId: "8a877114-b905-47c5-8b64-3a2d90679577",
  publishableClientKey: "pck_wbtp7yqb1h1xnyvgsjk53w1j8rcf72c6qt3cpdd3wmrhg",
  tokenStore: "cookie",
  redirectMethod: {
    useNavigate() {
      const navigate = useTanstackNavigate();
      return (to: string) => {
        navigate({ to });
      };
    },
  },
});
