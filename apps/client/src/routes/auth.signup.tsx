import { SignUp } from "@stackframe/react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/signup")({
  component: SignupComponent,
});

function SignupComponent() {
  return <SignUp fullPage />;
}
