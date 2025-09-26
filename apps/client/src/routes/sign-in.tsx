import { SignInComponent } from "@/components/sign-in-component";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-in")({
  component: SignInComponent,
});
