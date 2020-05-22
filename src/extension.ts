import * as vscode from 'vscode';
import { FBChatDocumentProvider } from './document-provider';
import { ChatEngine } from './chat-engine';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const chatEngine = new ChatEngine(context.globalState);

    let documnetProvider = vscode.workspace.registerTextDocumentContentProvider('fbchat', new FBChatDocumentProvider(chatEngine));

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "fbchat" is now active!');

    let say = vscode.commands.registerCommand('fbchat.openChat', async () => {
        if (!chatEngine.isActive()) {
            await chatEngine.start();
        }

        const threadsPromise = chatEngine.getThreads().then(threads => threads.map(thread => ({
            label: thread.name,
            id: thread.id
        })));

        const selected = await vscode.window.showQuickPick(threadsPromise);
        if (selected) {
            let uri = vscode.Uri.parse('fbchat:' + selected.id);
            let doc = await vscode.workspace.openTextDocument(uri); // calls back into the provider
            await vscode.window.showTextDocument(doc, { preview: false });
        }
    });

    let reply = vscode.commands.registerCommand('fbchat.reply', async () => {
        if (!vscode.window.activeTextEditor) {
            return; // no editor
        }
        let { document } = vscode.window.activeTextEditor;
        if (document.uri.scheme !== 'fbchat') {
            return; // not my scheme
        }

        const threadID = document.uri.path;
        const message = await vscode.window.showInputBox({
            prompt: "Enter a message"
        });
        if (!message) {
            return;
        }

        chatEngine.sendMessage(message, threadID);
    });

    let logout = vscode.commands.registerCommand('fbchat.logout', async () => {
        if (!chatEngine.isActive()) {
            return;
        }

        await chatEngine.logout();
    });

    context.subscriptions.push(documnetProvider);
    context.subscriptions.push(reply);
    context.subscriptions.push(logout);
    context.subscriptions.push(say);
}

// this method is called when your extension is deactivated
export function deactivate() { }
