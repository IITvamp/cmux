import { FloatingPane } from "@/components/floating-pane";
import { TaskInbox } from "@/components/inbox/TaskInbox";
import { TitleBar } from "@/components/TitleBar";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/$teamSlugOrId/inbox")({
  component: InboxComponent,
});

function InboxComponent() {
  const { teamSlugOrId } = Route.useParams();

  return (
    <FloatingPane header={<TitleBar title="Inbox" />}>
      <TaskInbox teamSlugOrId={teamSlugOrId} />
    </FloatingPane>
  );
}