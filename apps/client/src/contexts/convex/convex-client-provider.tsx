"use client";

import CmuxLogo from "@/components/logo/cmux-logo";
import { stackClientApp } from "@/stack";
import { SignIn, useUser } from "@stackframe/react";
import { useQuery } from "@tanstack/react-query";
import { ConvexProviderWithAuth, useConvexAuth } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useCallback, useMemo } from "react";
import { convexQueryClient } from "./convex-query-client";

const authJsonStaleTime = 45 * 60 * 1000; // 45 minutes before refresh

function useAuthFromStack() {
  const user = useUser({ or: "return-null" });
  const authJsonQuery = useQuery({
    queryKey: ["authJson"],
    queryFn: async () => {
      if (!user) return null;
      const authJson = await user.getAuthJson();
      return authJson;
    },
    staleTime: authJsonStaleTime,
  });
  const isLoading = false;
  const isAuthenticated = !!user;
  const fetchAccessToken = useCallback(
    async (_opts: { forceRefreshToken: boolean }) => {
      const stackUser = user
        ? user
        : await stackClientApp.getUser({ or: "return-null" });
      if (!stackUser) {
        return null;
      }
      const authJson = authJsonQuery.data
        ? authJsonQuery.data
        : await stackUser.getAuthJson();
      return authJson.accessToken ?? null;
    },
    [user, authJsonQuery.data]
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
            <SignIn />
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
