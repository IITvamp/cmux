"use client";

import CmuxLogo from "@/components/logo/cmux-logo";
import { stackClientApp } from "@/lib/stack";
import { SignIn, useUser } from "@stackframe/react";
import { useQuery } from "@tanstack/react-query";
import { ConvexProviderWithAuth, useConvexAuth } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useCallback, useMemo, useRef } from "react";
import { isElectron } from "@/lib/electron";
import { env } from "@/client-env";
import { convexQueryClient } from "./convex-query-client";

// refresh every 30 minutes
const authJsonRefreshInterval = 30 * 60 * 1000;

function useAuthFromStack() {
  const user = useUser();
  // hacky userRef because when localStorage changes for non-stack auth keys (like dark/light mode) it triggers a re-render of the user object
  const userRef = useRef(user);
  userRef.current = user;
  const authJsonQuery = useQuery({
    queryKey: ["authJson"],
    queryFn: async () => {
      if (!user) return null;
      const authJson = await user.getAuthJson();
      return authJson;
    },
    refetchInterval: authJsonRefreshInterval,
    refetchIntervalInBackground: true,
  });
  const isLoading = false;
  const isAuthenticated = useMemo(() => !!user, [user]);
  const fetchAccessToken = useCallback(
    async (_opts: { forceRefreshToken: boolean }) => {
      const stackUser = userRef.current
        ? userRef.current
        : await stackClientApp.getUser({ or: "return-null" });
      if (!stackUser) {
        return null;
      }
      const authJson = authJsonQuery.data
        ? authJsonQuery.data
        : await stackUser.getAuthJson();
      return authJson.accessToken ?? null;
    },
    [authJsonQuery.data]
  );

  const authResult = useMemo(
    () => ({
      isLoading,
      isAuthenticated,
      fetchAccessToken,
    }),
    [isAuthenticated, isLoading, fetchAccessToken]
  );
  return authResult;
}

function AuthenticatedOrLoading({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            className="absolute inset-0 w-screen h-dvh flex items-center justify-center bg-white dark:bg-black z-[99999999]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CmuxLogo showWordmark={false} height={50} />
          </motion.div>
        ) : !isAuthenticated ? (
          <motion.div
            key="signin"
            className="absolute inset-0 w-screen h-dvh flex items-center justify-center bg-white dark:bg-black z-[99999999]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {isElectron ? (
              <div className="flex flex-col items-center gap-4 p-6 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                <div className="text-center">
                  <p className="text-neutral-900 dark:text-neutral-100 font-medium">Sign in required</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">We'll open your browser to continue.</p>
                </div>
                  <button
                    onClick={() => {
                      const origin = env.VITE_WWW_ORIGIN;
                      const url = `${origin}/handler/sign-in/`;
                      // Open in external browser via Electron handler
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                    className="px-4 py-2 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90"
                  >   
                    Sign in with browser
                  </button>
                <p className="text-xs text-neutral-500 dark:text-neutral-500 text-center">
                  After signing in, you'll be returned automatically.
                </p>
              </div>
            ) : (
              <SignIn />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {isAuthenticated && children}
    </>
  );
}

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConvexProviderWithAuth
      client={convexQueryClient.convexClient}
      useAuth={useAuthFromStack}
    >
      <AuthenticatedOrLoading>{children}</AuthenticatedOrLoading>
    </ConvexProviderWithAuth>
  );
}
