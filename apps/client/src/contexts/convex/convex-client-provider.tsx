"use client";

import CmuxLogo from "@/components/logo/cmux-logo";
import { SignIn, useUser } from "@stackframe/react";
import { ConvexProviderWithAuth, useConvexAuth } from "convex/react";
import { motion } from "framer-motion";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { convexQueryClient } from "./convex-query-client";
function useAuthFromStack() {
  const user = useUser();
  const [isLoading, setIsLoading] = useState(true);

  const fetchAccessToken = useCallback(
    async (_opts: { forceRefreshToken: boolean }) => {
      if (!user) return null;
      const { accessToken } = await user.getAuthJson();
      setIsLoading(false);
      return accessToken ?? null;
    },
    [user]
  );

  const authResult = useMemo(
    () => ({
      isLoading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [user, fetchAccessToken, isLoading]
  );
  // console.log("authResult", authResult);
  return authResult;
}

function AuthenticatedOrLoading({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) {
    return (
      <motion.div
        className="w-screen h-dvh flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <CmuxLogo showWordmark={false} height={50} />
      </motion.div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="w-screen h-dvh flex items-center justify-center">
        <SignIn />
      </div>
    );
  }

  return <>{children}</>;
}

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  useUser({ or: "redirect" });
  return (
    <ConvexProviderWithAuth
      client={convexQueryClient.convexClient}
      useAuth={useAuthFromStack}
    >
      <AuthenticatedOrLoading>{children}</AuthenticatedOrLoading>
    </ConvexProviderWithAuth>
  );
}
