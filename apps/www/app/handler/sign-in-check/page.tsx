import { redirect } from "next/navigation";
import { stackServerApp } from "@/lib/utils/stack";

export const dynamic = "force-dynamic";

export default async function SignInCheckPage() {
  const user = await stackServerApp.getUser();

  if (user) {
    // User is authenticated, redirect to after-sign-in to handle the callback
    redirect("/handler/after-sign-in");
  } else {
    // User is not authenticated, redirect to sign-in
    redirect("/handler/sign-in/");
  }
}