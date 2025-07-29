import { useUser } from "@stackframe/stack";
import { useMutation } from "convex/react";
import { api } from "@cmux/convex/api";
import { useEffect } from "react";

export function useStackAuth(options?: { or?: 'redirect' }) {
  const user = useUser(options);
  const getOrCreateUser = useMutation(api.auth.getOrCreateUser);

  useEffect(() => {
    if (user) {
      // Sync user with Convex database
      getOrCreateUser({
        stackUserId: user.id,
        email: user.primaryEmail || "",
        displayName: user.displayName || undefined,
        avatarUrl: user.profileImageUrl || undefined,
      }).catch(console.error);
    }
  }, [user, getOrCreateUser]);

  return user;
}