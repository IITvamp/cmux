import { convexQuery } from "@convex-dev/react-query";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";

export const brainstormByTaskQueryOptions = ({
  teamSlugOrId,
  taskId,
}: {
  teamSlugOrId: string;
  taskId: string;
}) =>
  convexQuery(api.taskBrainstorms.getByTask, {
    teamSlugOrId,
    taskId: typedZid("tasks").parse(taskId),
  });

export const brainstormSummariesQueryOptions = ({
  teamSlugOrId,
}: {
  teamSlugOrId: string;
}) => convexQuery(api.taskBrainstorms.listSummaries, { teamSlugOrId });
