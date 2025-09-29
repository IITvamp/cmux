"use client";

import { getRandomKitty } from "@/components/kitties";
import CmuxLogoMarkAnimated from "@/components/logo/cmux-logo-mark-animated";
import { SignInComponent } from "@/components/sign-in-component";
import { fetchConvexAuth } from "@/lib/stack";
import { signalConvexAuthReady } from "./convex-auth-ready";
import { convexQueryClient } from "./convex-query-client";
import { Authenticated, ConvexProviderWithAuth, useConvexAuth } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useUser } from "@stackframe/react";

function useAuthFromStack() {
  const user = useUser({ or: "return-null" });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isLoading) {
      setIsLoading(false);
    }
  }, [user, isLoading]);

  const fetchAccessToken = useCallback(
    ({ forceRefreshToken }: { forceRefreshToken: boolean }) =>
      fetchConvexAuth({ forceRefreshToken }),
    []
  );

  return {
    isLoading,
    isAuthenticated: Boolean(user),
    fetchAccessToken,
  };
}

function ConvexAuthWatcher({
  onResolved,
}: {
  onResolved: (isAuthenticated: boolean) => void;
}) {
  const { isLoading, isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }
    signalConvexAuthReady(isAuthenticated);
    onResolved(isAuthenticated);
  }, [isLoading, isAuthenticated, onResolved]);

  return null;
}

function AuthenticatedOrSignIn({ children }: { children: ReactNode }) {
  return (
    <>
      <SignInComponent />
      <Authenticated>{children}</Authenticated>
    </>
  );
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [bootReady, setBootReady] = useState(false);
  const handleResolved = useCallback((isAuthenticated: boolean) => {
    if (!bootReady) {
      console.log(
        "[ConvexClientProvider] Auth resolved; authenticated=",
        isAuthenticated
      );
    }
    setBootReady(true);
  }, [bootReady]);

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
      <ConvexProviderWithAuth
        client={convexQueryClient.convexClient}
        useAuth={useAuthFromStack}
      >
        <ConvexAuthWatcher onResolved={handleResolved} />
        <AuthenticatedOrSignIn>{children}</AuthenticatedOrSignIn>
      </ConvexProviderWithAuth>
    </>
  );
}
