import { stackServerApp } from "@/app/stack";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/utils/www-env";

export const dynamic = "force-dynamic";

export default async function AfterSignInPage() {
  const stackCookies = await cookies();
  const stackRefreshToken = stackCookies.get(`stack-refresh-${env.NEXT_PUBLIC_STACK_PROJECT_ID}`)?.value;
  const stackAccessToken = stackCookies.get(`stack-access`)?.value;

  if (stackRefreshToken && stackAccessToken) {
    const target = `cmux://auth-callback?stack_refresh=${stackRefreshToken}&stack_access=${stackAccessToken}`
    console.log("redirecting to", target);
    redirect(target);
  }
}
