import type { StackClientApp } from "@stackframe/react";
import { decodeJwt } from "jose";

type User = Awaited<ReturnType<StackClientApp["getUser"]>>;
let cachedUser: User | null = null;
let userPromise: Promise<User | null> | null = null;

export async function cachedGetUser(
  stackClientApp: StackClientApp
): Promise<User | null> {
  // If we have a cached user, check if it's still valid
  if (cachedUser) {
    try {
      const tokens = await cachedUser.currentSession.getTokens();
      if (!tokens.accessToken) {
        cachedUser = null;
        userPromise = null;
        return null;
      }
      const jwt = decodeJwt(tokens.accessToken);
      if (jwt.exp && jwt.exp < Date.now() / 1000) {
        cachedUser = null;
        userPromise = null;
        return null;
      }
      return cachedUser;
    } catch (error) {
      console.warn("Error checking cached user validity:", error);
      cachedUser = null;
      userPromise = null;
    }
  }

  if (userPromise) {
    return userPromise;
  }

  userPromise = (async () => {
    try {
      const user = await stackClientApp.getUser();

      if (!user) {
        cachedUser = null;
        userPromise = null;
        return null;
      }

      const tokens = await user.currentSession.getTokens();

      if (!tokens.accessToken) {
        cachedUser = null;
        userPromise = null;
        return null;
      }
      cachedUser = user;
      userPromise = null;
      return user;
    } catch (error) {
      console.error("Error fetching user:", error);
      cachedUser = null;
      userPromise = null;
      return null;
    } finally {
      userPromise = null;
    }
  })();

  return userPromise;
}
