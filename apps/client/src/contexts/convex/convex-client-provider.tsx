"use client";

import { getRandomKitty } from "@/components/kitties";
import CmuxLogoMark from "@/components/logo/cmux-logo-mark";
import { api } from "@cmux/convex/api";
import { SignIn, useUser } from "@stackframe/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ConvexProviderWithAuth } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  authJsonQueryOptions,
  defaultAuthJsonRefreshInterval,
} from "./authJsonQueryOptions";
import { convexQueryClient } from "./convex-query-client";

// refresh every 30 minutes
const authJsonRefreshInterval = defaultAuthJsonRefreshInterval;

function BootReadyMarker({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady: () => Promise<void>;
}) {
  useEffect(() => {
    void onReady();
  }, [onReady]);
  return <>{children}</>;
}

function makeBootReadyHandler(setter: (v: boolean) => void) {
  return async () => {
    console.time("convexQueryClient.convexClient.query [boot]");
    const teamMemberships = await convexQueryClient.convexClient.query(
      api.teams.listTeamMemberships
    );
    console.timeEnd("convexQueryClient.convexClient.query [boot]");
    console.log("teamMemberships", teamMemberships);
    setter(true);
  };
}

function useAuthFromStack() {
  const user = useUser();
  const authJsonQuery = useSuspenseQuery({
    ...authJsonQueryOptions(user, authJsonRefreshInterval),
  });
  const isLoading = false;
  const isAuthenticated = useMemo(() => !!user, [user]);
  // Important: keep this function identity stable unless auth context truly changes.
  const fetchAccessToken = useCallback(
    async (_opts: { forceRefreshToken: boolean }) => {
      const cached = authJsonQuery.data;
      if (cached && typeof cached === "object" && "accessToken" in cached) {
        return cached?.accessToken ?? null;
      }
      return null;
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
  // Only gate on Stack user presence to avoid auth-loading flicker.
  const user = useUser({ or: "return-null" });
  const showSignIn = !user;
  return (
    <>
      <AnimatePresence mode="wait">
        {showSignIn ? (
          <motion.div
            key="signin"
            className="absolute inset-0 w-screen h-dvh flex items-center justify-center bg-white dark:bg-black z-[99999999]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <SignIn />
          </motion.div>
        ) : null}
      </AnimatePresence>
      {user && children}
    </>
  );
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [bootReady, setBootReady] = useState(false);
  const onBootReady = useMemo(() => makeBootReadyHandler(setBootReady), []);

  return (
    <>
      <AnimatePresence mode="sync" initial={false}>
        {!bootReady ? (
          <motion.div
            key="boot-loader"
            className="absolute inset-0 w-screen h-dvh flex flex-col items-center justify-center bg-white dark:bg-black z-[99999999]"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <CmuxLogoMark height={40} />
            <pre className="text-xs font-mono text-neutral-200 dark:text-neutral-800 absolute bottom-0 left-0 pl-4 pb-4">
              {getRandomKitty()}
            </pre>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Suspense fallback={null}>
        <BootReadyMarker onReady={onBootReady}>
          <ConvexProviderWithAuth
            client={convexQueryClient.convexClient}
            useAuth={useAuthFromStack}
          >
            <AuthenticatedOrLoading>{children}</AuthenticatedOrLoading>
          </ConvexProviderWithAuth>
        </BootReadyMarker>
      </Suspense>
    </>
  );
}
