import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "coderouter-extension" is now active!');

    let disposable = vscode.commands.registerCommand('coderouter.helloWorld', () => {
        console.log('Hello World from CodeRouter!');
        vscode.window.showInformationMessage('Hello World from CodeRouter!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    console.log('CodeRouter extension is now deactivated!');
}