import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "coderouter-extension" is now active!');

    let disposable = vscode.commands.registerCommand('coderouter.helloWorld', () => {
        console.log('Hello World from CodeRouter!');
        vscode.window.showInformationMessage('Hello World from CodeRouter!');
    });

    let runOpenCodeCommand = vscode.commands.registerCommand('coderouter.runOpenCode', () => {
        const terminal = vscode.window.createTerminal('OpenCode AI');
        terminal.show();
        terminal.sendText('bun x opencode-ai');
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(runOpenCodeCommand);
}

export function deactivate() {
    console.log('CodeRouter extension is now deactivated!');
}