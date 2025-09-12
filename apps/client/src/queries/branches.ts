import { waitForConnectedSocket } from "@/contexts/socket/socket-boot";
import { queryOptions } from "@tanstack/react-query";

export function branchesQueryOptions({
  teamSlugOrId,
  repoFullName,
}: {
  teamSlugOrId: string;
  repoFullName: string;
}) {
  return queryOptions({
    queryKey: ["branches", teamSlugOrId, repoFullName],
    queryFn: async () => {
      const socket = await waitForConnectedSocket();
      return await new Promise<string[]>((resolve, reject) => {
        socket.emit(
          "github-fetch-branches",
          { teamSlugOrId, repo: repoFullName },
          (response: { success: boolean; branches?: string[]; error?: string }) => {
            if (response.success) resolve(response.branches || []);
            else reject(new Error(response.error || "Failed to load branches"));
          }
        );
      });
    },
    staleTime: 10_000,
  });
}

