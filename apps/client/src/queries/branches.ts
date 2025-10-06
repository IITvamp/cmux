import { getGlobalRpcStub } from "@/contexts/socket/rpc-boot";
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
      const rpcStub = getGlobalRpcStub();
      if (!rpcStub) {
        throw new Error("RPC stub not connected");
      }

      const response = await rpcStub.githubFetchBranches({
        teamSlugOrId,
        repo: repoFullName,
      });

      if (response.success) {
        return response.branches;
      } else {
        throw new Error(response.error || "Failed to load branches");
      }
    },
    staleTime: 10_000,
  });
}
