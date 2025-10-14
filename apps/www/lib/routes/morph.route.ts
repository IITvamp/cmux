import { DEFAULT_MORPH_SNAPSHOT_ID } from "@/lib/utils/morph-defaults";
import { verifyTeamAccess } from "@/lib/utils/team-verification";
import { env } from "@/lib/utils/www-env";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { MorphCloudClient } from "morphcloud";
import { getConvex } from "../utils/get-convex";
import { selectGitIdentity } from "../utils/gitIdentity";
import { stackServerAppJs } from "../utils/stack";
import {
  configureGithubAccess,
  configureGitIdentity,
  fetchGitIdentityInputs,
} from "./sandboxes/git";

export const morphRouter = new OpenAPIHono();

const SetupInstanceBody = z
  .object({
    teamSlugOrId: z.string(),
    instanceId: z.string().optional(), // Existing instance ID to reuse
    selectedRepos: z.array(z.string()).optional(), // Repositories to clone
    ttlSeconds: z.number().default(60 * 30), // 30 minutes default
  })
  .openapi("SetupInstanceBody");

const SetupInstanceResponse = z
  .object({
    instanceId: z.string(),
    vscodeUrl: z.string(),
    clonedRepos: z.array(z.string()),
    removedRepos: z.array(z.string()),
    failedClones: z.array(z.object({
      repo: z.string(),
      error: z.string(),
      isAuth: z.boolean(),
    })),
  })
  .openapi("SetupInstanceResponse");

morphRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/morph/setup-instance",
    tags: ["Morph"],
    summary: "Setup a Morph instance with optional repository cloning",
    request: {
      body: {
        content: {
          "application/json": {
            schema: SetupInstanceBody,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: SetupInstanceResponse,
          },
        },
        description: "Instance setup successfully",
      },
      401: { description: "Unauthorized" },
      500: { description: "Failed to setup instance" },
    },
  }),
  async (c) => {
    const user = await stackServerAppJs.getUser({ tokenStore: c.req.raw });
    if (!user) {
      return c.text("Unauthorized", 401);
    }
    const { accessToken } = await user.getAuthJson();
    if (!accessToken) return c.text("Unauthorized", 401);
    const {
      teamSlugOrId,
      instanceId: existingInstanceId,
      selectedRepos,
      ttlSeconds,
    } = c.req.valid("json");

    const convex = getConvex({ accessToken });

     // Verify team access and get the team
     const team = await verifyTeamAccess({ req: c.req.raw, teamSlugOrId });
     const githubAccessTokenPromise = (async () => {
       const githubAccount = await user.getConnectedAccount("github");
       if (!githubAccount) {
         return {
           githubAccessTokenError: "GitHub account not found",
           githubAccessToken: null,
         } as const;
       }
       const { accessToken: githubAccessToken } =
         await githubAccount.getAccessToken();
       if (!githubAccessToken) {
         return {
           githubAccessTokenError: "GitHub access token not found",
           githubAccessToken: null,
         } as const;
       }

       return { githubAccessTokenError: null, githubAccessToken } as const;
     })();



      // Get VSCode URL
      const vscodeUrl = instance.networking.httpServices.find(
        (service) => service.port === 39378
      )?.url;

      if (!vscodeUrl) {
        throw new Error("VSCode URL not found");
      }

       const { githubAccessToken, githubAccessTokenError } =
         await githubAccessTokenPromise;
       if (githubAccessTokenError) {
         console.error(
           `[sandboxes.start] GitHub access token error: ${githubAccessTokenError}`
         );
         return c.text("Failed to resolve GitHub credentials", 401);
       }
       await configureGithubAccess(instance, githubAccessToken);

       const url = `${vscodeUrl}/?folder=/root/workspace`;

       // Handle repository management if repos are specified
       const removedRepos: string[] = [];
       const clonedRepos: string[] = [];
       const failedClones: { repo: string; error: string; isAuth: boolean }[] =
         [];

       if (selectedRepos && selectedRepos.length > 0) {
         const isSingleRepo = selectedRepos.length === 1;
         const repo = isSingleRepo ? selectedRepos[0] : null;
         if (isSingleRepo && repo) {
           // Clone single repo directly to /root/workspace
           const [owner, repoName] = repo.split('/');
           console.log(`Cloning single repo ${repo} directly to /root/workspace`);
           const cloneCmd = await instance.exec(`git clone https://github.com/${repo}.git /root/workspace 2>&1`);
           if (cloneCmd.exit_code === 0) {
             console.log(`Successfully cloned ${repo}`);
           } else {
             console.error(`Failed to clone ${repo}: ${cloneCmd.stderr || cloneCmd.stdout}`);
           }
         } else {
           // Clone multiple repos to subdirectories
           for (const repo of selectedRepos) {
             const [owner, repoName] = repo.split('/');
             console.log(`Cloning repo ${repo} to /root/workspace/${repoName}`);
             const cloneCmd = await instance.exec(`mkdir -p /root/workspace && cd /root/workspace && git clone https://github.com/${repo}.git ${repoName} 2>&1`);
             if (cloneCmd.exit_code === 0) {
               console.log(`Successfully cloned ${repo}`);
             } else {
               console.error(`Failed to clone ${repo}: ${cloneCmd.stderr || cloneCmd.stdout}`);
             }
           }
         }
       }
           }
         }

         // If switching from multiple repos to single repo, prepare for direct cloning
         if (isSingleRepo && currentWorkspaceState === 'multiple-repos') {
           console.log('Clearing workspace for single repo setup');
           await instance.exec(`rm -rf /root/workspace/* /root/workspace/.* 2>/dev/null || true`);
         }
        // Validate repo format and check for duplicates
        const repoNames = new Map<string, string>(); // Map of repo name to full path
        const reposByOwner = new Map<string, string[]>(); // Map of owner -> list of full repo names
        for (const repo of selectedRepos) {
          // Validate format: should be owner/repo
          if (!repo.includes("/") || repo.split("/").length !== 2) {
            return c.text(
              `Invalid repository format: ${repo}. Expected format: owner/repo`,
              400
            );
          }

          const [owner, repoName] = repo.split("/");
          if (!repoName) {
            return c.text(`Invalid repository: ${repo}`, 400);
          }

          // Check for duplicate repo names
          if (repoNames.has(repoName)) {
            return c.text(
              `Duplicate repository name detected: '${repoName}' from both '${repoNames.get(repoName)}' and '${repo}'. ` +
                `Repositories with the same name cannot be cloned to the same workspace.`,
              400
            );
          }
          repoNames.set(repoName, repo);

          // Group by owner for GitHub App installations
          if (!reposByOwner.has(owner)) {
            reposByOwner.set(owner, []);
          }
          reposByOwner.get(owner)!.push(repo);
        }

        // First, get list of existing repos with their remote URLs
        const existingRepos = new Map<string, string>(); // Map of repo name to remote URL

        if (isSingleRepo) {
          // For single repo, check if /root/workspace is a git repo
          const singleRepoCheckCmd = await instance.exec(
            "if [ -d /root/workspace/.git ]; then cd /root/workspace && git remote get-url origin 2>/dev/null || echo 'no-remote'; else echo 'not-git'; fi"
          );
          const remoteUrl = singleRepoCheckCmd.stdout.trim();
          if (remoteUrl !== 'not-git' && remoteUrl !== 'no-remote') {
            const repoName = selectedRepos[0].split('/').pop()!;
            existingRepos.set(repoName, remoteUrl);
          }
        } else {
          // For multiple repos, check subdirectories
          const listReposCmd = await instance.exec(
            "for dir in /root/workspace/*/; do " +
              'if [ -d "$dir/.git" ]; then ' +
              'basename "$dir"; ' +
              "cd \"$dir\" && git remote get-url origin 2>/dev/null || echo 'no-remote'; " +
              "fi; done"
          );

          const lines = listReposCmd.stdout.split("\n").filter(Boolean);

          for (let i = 0; i < lines.length; i += 2) {
            const repoName = lines[i]?.trim();
            const remoteUrl = lines[i + 1]?.trim();
            if (repoName && remoteUrl && remoteUrl !== "no-remote") {
              existingRepos.set(repoName, remoteUrl);
            } else if (repoName) {
              existingRepos.set(repoName, "");
            }
          }
        }
        } else {
          // For multiple repos, check subdirectories
          const listReposCmd = await instance.exec(
            "for dir in /root/workspace/*/; do " +
              'if [ -d "$dir/.git" ]; then ' +
              'basename "$dir"; ' +
              "cd \"$dir\" && git remote get-url origin 2>/dev/null || echo 'no-remote'; " +
              "fi; done"
          );

          const lines = listReposCmd.stdout.split("\n").filter(Boolean);

          for (let i = 0; i < lines.length; i += 2) {
            const repoName = lines[i]?.trim();
            const remoteUrl = lines[i + 1]?.trim();
            if (repoName && remoteUrl && remoteUrl !== "no-remote") {
              existingRepos.set(repoName, remoteUrl);
            } else if (repoName) {
              existingRepos.set(repoName, "");
            }
          }
        }

        // Determine which repos to remove
        for (const [existingName, existingUrl] of existingRepos) {
          const selectedRepo = repoNames.get(existingName);

          if (!selectedRepo) {
            // Repo not in selected list, remove it
            console.log(`Removing repository: ${existingName}`);
            if (isSingleRepo) {
              await instance.exec(`rm -rf /root/workspace/* /root/workspace/.* 2>/dev/null || true`);
            } else {
              await instance.exec(`rm -rf /root/workspace/${existingName}`);
            }
            removedRepos.push(existingName);
          } else if (existingUrl && !existingUrl.includes(selectedRepo)) {
            // Repo exists but points to different remote, remove and re-clone
            console.log(
              `Repository ${existingName} points to different remote, removing for re-clone`
            );
            if (isSingleRepo) {
              await instance.exec(`rm -rf /root/workspace/* /root/workspace/.* 2>/dev/null || true`);
            } else {
              await instance.exec(`rm -rf /root/workspace/${existingName}`);
            }
            removedRepos.push(existingName);
            existingRepos.delete(existingName); // Mark for re-cloning
          }
        }

        // For each owner group, mint a token and clone that owner's repos
        for (const [, repos] of reposByOwner) {
          // Clone new repos for this owner in parallel with retries
          const clonePromises = repos.map(async (repo) => {
            const repoName = repo.split("/").pop()!;
            if (!existingRepos.has(repoName)) {
              console.log(`Cloning repository: ${repo}`);

              const maxRetries = 3;
              let lastError: string | undefined;
              let isAuthError = false;

               for (let attempt = 1; attempt <= maxRetries; attempt++) {
                 let cloneCommand;
                 if (isSingleRepo) {
                   cloneCommand = `rm -rf /root/workspace/* /root/workspace/.* 2>/dev/null || true && git clone https://github.com/${repo}.git /root/workspace 2>&1`;
                 } else {
                   cloneCommand = `mkdir -p /root/workspace && cd /root/workspace && git clone https://github.com/${repo}.git ${repoName} 2>&1`;
                 }
                 const cloneCmd = await instance.exec(cloneCommand);

                if (cloneCmd.exit_code === 0) {
                  return { success: true as const, repo };
                } else {
                  lastError = cloneCmd.stderr || cloneCmd.stdout;

                  // Check for authentication errors
                  isAuthError =
                    lastError.includes("Authentication failed") ||
                    lastError.includes("could not read Username") ||
                    lastError.includes("could not read Password") ||
                    lastError.includes("Invalid username or password") ||
                    lastError.includes("Permission denied") ||
                    lastError.includes("Repository not found") ||
                    lastError.includes("403");

                  // Don't retry authentication errors
                  if (isAuthError) {
                    console.error(
                      `Authentication failed for ${repo}: ${lastError}`
                    );
                    break;
                  }

                  if (attempt < maxRetries) {
                    console.log(
                      `Clone attempt ${attempt} failed for ${repo}, retrying...`
                    );
                     // Clean up partial clone if it exists
                     let cleanupCommand;
                     if (isSingleRepo) {
                       cleanupCommand = `rm -rf /root/workspace`;
                     } else {
                       cleanupCommand = `rm -rf /root/workspace/${repoName}`;
                     }
                     await instance.exec(cleanupCommand);
                    // Wait before retry with exponential backoff
                    await new Promise((resolve) =>
                      setTimeout(resolve, attempt * 1000)
                    );
                  }
                }
              }

              const errorMsg = isAuthError
                ? `Authentication failed - check repository access permissions`
                : `Failed after ${maxRetries} attempts`;

              console.error(
                `Failed to clone ${repo}: ${errorMsg}\nDetails: ${lastError}`
              );
              return {
                success: false as const,
                repo,
                error: lastError || "Unknown error",
                isAuth: isAuthError,
              };
            } else {
              console.log(
                `Repository ${repo} already exists with correct remote, skipping clone`
              );
              return null;
            }
          });

          const results = await Promise.all(clonePromises);

          for (const result of results) {
            if (result && "success" in result) {
              if (result.success) {
                clonedRepos.push(result.repo);
              } else {
                failedClones.push({
                  repo: result.repo,
                  error: result.error,
                  isAuth: result.isAuth,
                });
              }
            }
          }
        }
      }

      console.log(`VSCode Workspace URL: ${url}`);

       return c.json({
         instanceId,
         vscodeUrl: url,
         clonedRepos,
         removedRepos,
       });
    } catch (error) {
      console.error("Failed to setup Morph instance:", error);
      return c.text("Failed to setup instance", 500);
    }
  }
);
