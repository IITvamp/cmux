"use client";

import CmuxLogo from "@/components/logo/cmux-logo";
import { SignIn, useUser } from "@stackframe/react";
import { useQuery } from "@tanstack/react-query";
import { ConvexProviderWithAuth } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  authJsonQueryOptions,
  defaultAuthJsonRefreshInterval,
  type AuthJson,
} from "./authJsonQueryOptions";
import { convexQueryClient } from "./convex-query-client";

// refresh every 30 minutes
const authJsonRefreshInterval = defaultAuthJsonRefreshInterval;

function BootReadyMarker({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady: () => void;
}) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return <>{children}</>;
}

function makeBootReadyHandler(setter: (v: boolean) => void) {
  return () => setter(true);
}

function useAuthFromStack() {
  // Prefer a stable null-or-user value to avoid suspense or transient values.
  const user = useUser({ or: "return-null" });

  // Keep refs for values we may want to read without recreating callbacks.
  const userRef = useRef(user);
  userRef.current = user;

  // Suspense the initial auth JSON when a user exists to avoid double flashes.
  const enableAuthQuery = !!user;
  const authJsonQuery = useQuery({
    ...authJsonQueryOptions(user, authJsonRefreshInterval),
    enabled: enableAuthQuery,
    staleTime: 5 * 60 * 1000,
  });
  // Manually suspend until the first authJson resolves when a user exists.
  const suspenderRef = useRef<{ p: Promise<void>; resolve: () => void } | null>(
    null
  );
  if (enableAuthQuery && typeof authJsonQuery.data === "undefined") {
    if (!suspenderRef.current) {
      let resolve!: () => void;
      const p = new Promise<void>((r) => {
        resolve = r;
      });
      suspenderRef.current = { p, resolve };
    }
    throw suspenderRef.current.p;
  }
  useEffect(() => {
    if (suspenderRef.current && typeof authJsonQuery.data !== "undefined") {
      suspenderRef.current.resolve();
      suspenderRef.current = null;
    }
  }, [authJsonQuery.data]);
  const authJsonRef = useRef<AuthJson | undefined>(authJsonQuery.data);
  useEffect(() => {
    authJsonRef.current = authJsonQuery.data;
  }, [authJsonQuery.data]);

  const isLoading = false;
  const isAuthenticated = useMemo(() => !!user, [user]);

  // Important: keep this function identity stable unless auth context truly changes.
  const fetchAccessToken = useCallback(
    async (_opts: { forceRefreshToken: boolean }) => {
      const cached = authJsonRef.current;
      if (cached && typeof cached === "object" && "accessToken" in cached) {
        return cached?.accessToken ?? null;
      }
      return null;
    },
    []
  );

  const authResult = useMemo(
    () => ({
      isLoading,
      isAuthenticated,
      fetchAccessToken,
    }),
    [isAuthenticated, isLoading, fetchAccessToken]
  );
  // console.log("authResult", authResult);
  return authResult;
}

function AuthenticatedOrLoading({ children }: { children: ReactNode }) {
  // Only gate on Stack user presence to avoid auth-loading flicker.
  const user = useUser({ or: "return-null" });
  const showSignIn = !user;
  useEffect(() => {
    console.log(
      "[AuthOverlay] gate",
      JSON.stringify({
        showSignIn,
        path: typeof window !== "undefined" ? window.location.pathname : "",
      })
    );
  }, [showSignIn]);
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
      {children}
    </>
  );
}

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [bootReady, setBootReady] = useState(false);
  const onBootReady = useMemo(() => makeBootReadyHandler(setBootReady), []);

  return (
    <>
      <AnimatePresence mode="sync" initial={false}>
        {!bootReady ? (
          <motion.div
            key="boot-loader"
            className="absolute inset-0 w-screen h-dvh flex items-center justify-center bg-white dark:bg-black z-[99999999]"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <CmuxLogo showWordmark={false} height={50} />
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
