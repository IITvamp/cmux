import { useUser } from "@stackframe/react";
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {
  const user = useUser({ or: "return-null" });
  const teams = user?.useTeams() ?? [];

  // If authenticated with 0 or >1 teams, use the team picker
  if (user && (teams.length === 0 || teams.length > 1)) {
    return <Navigate to="/team-picker" />;
  }

  // If exactly one team, go straight there
  if (user && teams.length === 1) {
    const cm = teams[0]!.clientMetadata as unknown;
    const teamSlugOrId =
      cm && typeof cm === "object" && cm !== null && "slug" in (cm as Record<string, unknown>) &&
      typeof (cm as Record<string, unknown>).slug === "string"
        ? ((cm as Record<string, unknown>).slug as string)
        : teams[0]!.id;
    return (
      <Navigate to="/$teamSlugOrId/dashboard" params={{ teamSlugOrId }} />
    );
  }

  // Fallback when not authenticated: send to picker (will show sign-in)
  return <Navigate to="/team-picker" />;
}
