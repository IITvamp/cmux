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
      const { accessToken } = await user.getAuthJson();
      return accessToken ?? null;
    },
    [user]
  );

  const authResult = useMemo(
    () => ({
      isLoading: false,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [user, fetchAccessToken]
  );
  console.log("authResult", authResult);
  return authResult;
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
