import { SignIn } from "@stackframe/stack";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/login")({
  component: LoginComponent,
});

function LoginComponent() {
  return <SignIn fullPage />;
}