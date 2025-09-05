import { stackServerApp } from "@/lib/utils/stack";
import { env } from "@/lib/utils/www-env";
import { StackAdminApp } from "@stackframe/js";
import { decodeJwt } from "jose";

export type GithubUserInfo = {
  id: number;
  login: string;
  derivedNoreply: string;
  emails: string[];
  primaryEmail: string | null;
  canReadEmails: boolean;
};

type TokenLike =
  | string
  | {
      accessToken?: string;
      token?: string;
      value?: string;
      access_token?: string;
    };

function normalizeToken(t: TokenLike | null | undefined): string | null {
  if (!t) return null;
  if (typeof t === "string") return t;
  const o = t as Record<string, unknown>;
  return (
    (typeof o.accessToken === "string" ? (o.accessToken as string) : null) ||
    (typeof o.token === "string" ? (o.token as string) : null) ||
    (typeof o.value === "string" ? (o.value as string) : null) ||
    (typeof o.access_token === "string" ? (o.access_token as string) : null)
  );
}

export async function fetchGithubUserInfoForRequest(
  req: Request
): Promise<GithubUserInfo | null> {
  const user = await stackServerApp.getUser({ tokenStore: req });
  if (!user) return null;

  const { accessToken } = await user.getAuthJson();
  if (!accessToken) return null;
  const jwt = decodeJwt(accessToken);
  const userId = String(jwt.sub || "");
  if (!userId) return null;

  const admin = new StackAdminApp({
    tokenStore: "memory",
    projectId: env.NEXT_PUBLIC_STACK_PROJECT_ID,
    publishableClientKey: env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
    secretServerKey: env.STACK_SECRET_SERVER_KEY,
    superSecretAdminKey: env.STACK_SUPER_SECRET_ADMIN_KEY,
  });
  const adminUser = await admin.getUser(userId);
  if (!adminUser) return null;
  const connected = await adminUser.getConnectedAccount("github");
  if (!connected) return null;

  const raw = await connected.getAccessToken();
  const token = normalizeToken(raw);
  if (!token) return null;

  // Fetch id/login
  const uRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!uRes.ok) return null;
  const u = (await uRes.json()) as { id: number; login: string };

  const derivedNoreply = `${u.id}+${u.login}@users.noreply.github.com`;

  // Try to fetch emails; may require user:email scope
  let emails: string[] = [];
  let primaryEmail: string | null = null;
  let canReadEmails = false;
  try {
    const eRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (eRes.ok) {
      type EmailRec = {
        email: string;
        primary?: boolean;
        verified?: boolean;
        visibility?: string | null;
      };
      const list = (await eRes.json()) as EmailRec[];
      if (Array.isArray(list)) {
        emails = list.map((r) => r.email);
        const primary = list.find((r) => r.primary);
        primaryEmail = primary ? primary.email : null;
        canReadEmails = true;
      }
    }
  } catch {
    // Ignore; token may lack scope
  }

  return {
    id: u.id,
    login: u.login,
    derivedNoreply,
    emails,
    primaryEmail,
    canReadEmails,
  };
}

