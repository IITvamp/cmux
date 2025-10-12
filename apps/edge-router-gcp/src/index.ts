import { createEdgeRouterServer } from "./server.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const host = process.env.HOST ?? "0.0.0.0";
const allowInsecureTarget = process.env.ALLOW_INSECURE_TARGET === "1";

const { server } = createEdgeRouterServer({
  allowInsecureTarget,
});

server.listen(port, host, () => {
  console.log(`edge router listening on ${host}:${port}`);
});
