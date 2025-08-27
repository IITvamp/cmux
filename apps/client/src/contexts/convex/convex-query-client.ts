import { env } from "@/client-env";
import { ConvexQueryClient } from "@convex-dev/react-query";

export const convexQueryClient = new ConvexQueryClient(env.VITE_CONVEX_URL);
