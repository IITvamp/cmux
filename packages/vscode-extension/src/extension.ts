import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("coderouter-extension is active");

  let disposable = vscode.commands.registerCommand(
    "coderouter.helloWorld",
    async () => {
      console.log("Hello World from CodeRouter!");
      vscode.window.showInformationMessage("Hello World from CodeRouter!");
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    }
  );

  let run = vscode.commands.registerCommand("coderouter.run", async () => {
    // Create and show terminal
    const terminal = vscode.window.createTerminal({
      name: "cmux",
      location: vscode.TerminalLocation.Panel,
    });
    // terminal.show();

    // // Split the editor area first
    // await vscode.commands.executeCommand("workbench.action.splitEditor");

    // Open git changes view
    await vscode.commands.executeCommand("git.viewChanges");

    // poll until terminal is ready
    // while (terminal.exitStatus === undefined) {
    //   await new Promise((resolve) => setTimeout(resolve, 1000));
    // }
    // vscode.window.terminals.find((t) => t.name === "cmux");

    console.log(terminal);

    // Send command to terminal
    // terminal.sendText("bun x opencode-ai");

    // Focus back on terminal
    // terminal.show();
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(run);
}

export function deactivate() {
  console.log("CodeRouter extension is now deactivated!");
}
