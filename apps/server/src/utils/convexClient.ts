import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "http://127.0.0.1:3212";
console.log("Connecting to Convex at:", CONVEX_URL);
export const convex = new ConvexHttpClient(CONVEX_URL);
