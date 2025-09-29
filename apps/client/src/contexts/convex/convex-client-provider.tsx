"use client";

import { getRandomKitty } from "@/components/kitties";
import CmuxLogoMarkAnimated from "@/components/logo/cmux-logo-mark-animated";
import { cachedGetUser } from "@/lib/cachedGetUser";
import { stackClientApp } from "@/lib/stack";
import { useUser } from "@stackframe/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Authenticated, ConvexProviderWithAuth } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authJsonQueryOptions } from "./authJsonQueryOptions";
import { signalConvexAuthReady } from "./convex-auth-ready";
import { convexQueryClient } from "./convex-query-client";
import { SignInComponent } from "@/components/sign-in-component";

function OnReadyComponent({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    console.log("[ConvexClientProvider] Authenticated, boot ready");
    onReady();
  }, [onReady]);
  return null;
}

function useAuthFromStack() {
  const user = useUser();
  const authJsonQuery = useSuspenseQuery({
    ...authJsonQueryOptions(),
  });
  const isLoading = false;
  const accessToken = authJsonQuery.data?.accessToken ?? null;
  // Only consider authenticated once an access token is available.
  const isAuthenticated = useMemo(
    () => Boolean(user && accessToken),
    [user, accessToken],
  );

  // Important: keep this function identity stable unless auth context truly changes.
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (forceRefreshToken) {
        const user = await stackClientApp.getUser();
        if (!user) {
          throw new Error("User not found");
        }
        const authJson = await user.getAuthJson();
        if (!authJson) {
          throw new Error("Auth JSON not found");
        }
        const accessToken = authJson.accessToken;
        if (!accessToken) {
          throw new Error("No access token");
        }
        return accessToken;
      }
      const cached = authJsonQuery.data;
      if (cached?.accessToken) {
        return cached.accessToken;
      }
      // Fallback: directly ask Stack for a fresh token in case the cache is stale
      const u = await cachedGetUser(stackClientApp);

      const fresh = await u?.getAuthJson();
      return fresh?.accessToken ?? null;
    },
    [authJsonQuery.data],
  );

  const authResult = useMemo(
    () => ({
      isLoading,
      isAuthenticated,
      fetchAccessToken,
    }),
    [isAuthenticated, isLoading, fetchAccessToken],
  );
  return authResult;
}

function AuthenticatedOrSignIn({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady: () => void;
}) {
  return (
    <>
      <SignInComponent />
      <Authenticated>
        <OnReadyComponent onReady={onReady} />
        {children}
      </Authenticated>
    </>
  );
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [bootReady, setBootReady] = useState(false);
  const onBootReady = useCallback(() => {
    signalConvexAuthReady(true);
    setBootReady(true);
  }, []);

  return (
    <>
      <AnimatePresence mode="sync" initial={false}>
        {!bootReady ? (
          <motion.div
            key="boot-loader"
            className="absolute inset-0 w-screen h-dvh flex flex-col items-center justify-center bg-white dark:bg-black z-[var(--z-global-blocking)]"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <CmuxLogoMarkAnimated height={40} duration={2.9} />
            <pre className="text-xs font-mono text-neutral-200 dark:text-neutral-800 absolute bottom-0 left-0 pl-4 pb-4">
              {getRandomKitty()}
            </pre>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <Suspense fallback={null}>
        <ConvexProviderWithAuth
          client={convexQueryClient.convexClient}
          useAuth={useAuthFromStack}
        >
          <AuthenticatedOrSignIn onReady={onBootReady}>
            {children}
          </AuthenticatedOrSignIn>
        </ConvexProviderWithAuth>
      </Suspense>
    </>
  );
}
