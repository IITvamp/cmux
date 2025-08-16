import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { serve } from "@hono/node-server";
import { z } from "zod";
import app from "./index.js";

extendZodWithOpenApi(z);

const PORT = 3000;

serve({ ...app, port: PORT }).addListener("listening", () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
