"use client";

import { useUser } from "@stackframe/react";
import { ConvexProviderWithAuth } from "convex/react";
import { type ReactNode, useCallback, useMemo } from "react";
import { convexQueryClient } from "./convex-query-client";

function useAuthFromStack() {
  const user = useUser();

  const fetchAccessToken = useCallback(
    async (_opts: { forceRefreshToken: boolean }) => {
      if (!user) return null;
      const { accessToken } = await user.getAuthJson(); // returns { accessToken }
      return accessToken ?? null;
    },
    [user]
  );

  return useMemo(
    () => ({
      isLoading: false, // Stack's client returns user/null without a separate loading flag
      isAuthenticated: !!user, // Convex uses this to know whether to attempt authed calls
      fetchAccessToken,
    }),
    [user, fetchAccessToken]
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
      {children}
    </ConvexProviderWithAuth>
  );
}
