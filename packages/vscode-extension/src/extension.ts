import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "coderouter-extension" is now active!');

    let disposable = vscode.commands.registerCommand('coderouter.helloWorld', () => {
        console.log('Hello World from CodeRouter!');
        vscode.window.showInformationMessage('Hello World from CodeRouter!');
    });

    let runOpenCodeCommand = vscode.commands.registerCommand('coderouter.runOpenCode', async () => {
        // Create and show terminal
        const terminal = vscode.window.createTerminal({
            name: 'OpenCode AI',
            location: vscode.TerminalLocation.Panel
        });
        terminal.show();
        
        // Split the editor area first
        await vscode.commands.executeCommand('workbench.action.splitEditor');
        
        // Open git changes view
        await vscode.commands.executeCommand('git.viewChanges');
        
        // Send command to terminal
        terminal.sendText('bun x opencode-ai');
        
        // Focus back on terminal
        terminal.show();
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(runOpenCodeCommand);
}

export function deactivate() {
    console.log('CodeRouter extension is now deactivated!');
}