import { app } from "../hono-app";

export async function honoTestFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return await app.request(input, init);
}
