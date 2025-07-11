import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { ConvexReactClient } from "convex/react";

export const convex = new ConvexReactClient("http://127.0.0.1:3210");
export const convexQueryClient = new ConvexQueryClient(
  // TODO: fix this by upgrading convex when alpha is merged
  convex as unknown as string
);
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
  },
});
convexQueryClient.connect(queryClient);
