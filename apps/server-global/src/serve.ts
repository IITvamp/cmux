import { serve } from "@hono/node-server";
import app from "./index.js";

const PORT = 3000;

serve({ ...app, port: PORT }).addListener("listening", () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
