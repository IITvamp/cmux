[x] instead of using node-pty, install openvscode directly and make an extension that lets us interact with vscode's terminal and everything via socketio. like the extension needs to expose a socketio server that we can connect to and then we can send commands to the terminal and get the output back.
[ ] copy ~/.claude/CLAUDE.md to relevant places
[ ] copy CLAUDE.md to AGENTS.md, GEMINI.md etc for openai, gemini, etc.
[ ] figure out intricacies of deploying the Dockerfile to daytona
[x] create morph snapshot
[ ] make it easy to provide context to claude code -- my fav is using cmd + p to open a ton of editors
[x] copy over the credentials properly
[ ] make it easy to create a new task from scratch without any existing directory or git repo
[ ] fallback if user doesn't use gh cli
[ ] authentication
[ ] whenever i start typing in /dashboard, even if i'm not focused on the textinput, it should automatically start typing in the textinput (including the keys i just pressed but weren't focused on the textinput)

[ ] figure out how to get git working, rn worktrees are broken
[ ] make MorphVSCodeInstance actually work
[ ] vercel previews
[ ] vercel comments but it actually just pipes it to claude code and it auto makes a PR!
[ ] auto set up devcontainers: `bun x @devcontainers/cli up --workspace-folder /root/workspace`
[ ] make persistent [worktree/branchname]-vscode.cmux.local domains for each vscode container instance. the cmux.local domains also need to support mapping to the ports in each of the DockerVSCodeInstances. like [worktree/branchname]-[portnumber].cmux.local should map to the port number of the vscode instance.
[ ] rename branches after a task is created to something reasonable
[ ] plan mode for claude code
[ ] update state for agent when they finish a task or fail a task
