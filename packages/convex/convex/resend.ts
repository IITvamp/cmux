import { components } from "./_generated/api";
import { Resend } from "@convex-dev/resend";

// Shared instance for sending emails via Resend component
// Cast through unknown to avoid requiring regenerated component types in CI
export const resendClient: Resend = new Resend(
  (components as unknown as { resend: unknown }).resend as never,
  { testMode: false }
);
