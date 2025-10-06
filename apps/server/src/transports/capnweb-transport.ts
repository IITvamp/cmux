import { nodeHttpBatchRpcResponse } from "capnweb";
import type { Application, Request, Response } from "express";
import { GitDiffManager } from "../gitDiff";
import { ServerRpcHandlers } from "../rpc-handlers";
import { serverLogger } from "../utils/fileLogger";
import { runWithAuth } from "../utils/requestContext";

/**
 * Sets up capnweb RPC endpoints on the HTTP server.
 * Replaces the Socket.IO transport with HTTP batch RPC.
 */
export function setupCapnwebRpc(
  app: Application,
  gitDiffManager: GitDiffManager,
) {
  serverLogger.info("Setting up capnweb RPC transport");

  function applyCorsHeaders(res: Response, origin: string | undefined) {
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "content-type, accept, authorization, capnweb-batch"
    );
  }

  app.options("/rpc", (req, res) => {
    applyCorsHeaders(res, req.headers.origin);
    res.sendStatus(204);
  });

  app.post("/rpc", async (req: Request, res: Response) => {
    applyCorsHeaders(res, req.headers.origin);
    serverLogger.info("Handling RPC request");

    try {
      const token = typeof req.query.auth === "string" ? req.query.auth : null;
      const tokenJsonParam = req.query.auth_json;
      const teamSlugOrId =
        typeof req.query.team === "string" && req.query.team
          ? req.query.team
          : "default";

      if (!token) {
        res.status(401).json({ error: "Missing auth token" });
        return;
      }

      const tokenJson =
        typeof tokenJsonParam === "string" ? tokenJsonParam : undefined;

      // Create RPC handlers with the team context
      const rpcHandlers = new ServerRpcHandlers(gitDiffManager, teamSlugOrId);

      // Handle the RPC request within auth context
      await runWithAuth(token, tokenJson, async () => {
        await nodeHttpBatchRpcResponse(req, res, rpcHandlers, {
          onSendError: (error) => {
            serverLogger.error("RPC error:", error);
            return error; // Send full error to client
          },
        });
      });
    } catch (error) {
      serverLogger.error("Error handling RPC request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: error instanceof Error ? error.message : "Internal server error",
        });
      }
    }
  });

  serverLogger.info("Capnweb RPC transport ready on POST /rpc");

  return {
    close: () => {
      serverLogger.info("Closing capnweb RPC transport");
      // Cleanup if needed
    },
  };
}
