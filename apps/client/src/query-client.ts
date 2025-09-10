import { convexQueryClient } from "@/contexts/convex/convex-query-client";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
  },
});
convexQueryClient.connect(queryClient);

// Subscribe to query cache updates to log errors centrally
queryClient.getQueryCache().subscribe((event) => {
  try {
    const query = event.query;
    if (!query) return;
    const state = query.state as { status?: string; error?: unknown };
    if (state.status === "error") {
      console.error("[ReactQueryError]", {
        queryKey: query.queryKey,
        error: state.error,
      });
    }
  } catch (e) {
    console.error("[ReactQueryError] Failed to log query error", e);
  }
});
