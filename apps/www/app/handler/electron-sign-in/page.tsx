import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/lib/utils/www-env";

export const dynamic = "force-dynamic";

export default async function ElectronSignInPage() {
  const stackCookies = await cookies();
  const stackRefreshToken = stackCookies.get(`stack-refresh-${env.NEXT_PUBLIC_STACK_PROJECT_ID}`)?.value;
  const stackAccessToken = stackCookies.get("stack-access")?.value;

  if (stackRefreshToken && stackAccessToken) {
    redirect("/handler/after-sign-in");
  }

  redirect("/handler/sign-in/");
}
