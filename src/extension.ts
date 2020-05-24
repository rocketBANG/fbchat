import * as vscode from 'vscode';
import { FBChatDocumentProvider } from './document-provider';
import { ChatEngine } from './chat-engine';
import { ChatThreadsProvider } from './tree-data-provider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const chatEngine = new ChatEngine(context.globalState);

  let isMuted = false;

  let documnetProvider = vscode.workspace.registerTextDocumentContentProvider('fbchat', new FBChatDocumentProvider(chatEngine));

  vscode.window.createTreeView('fbchats', {
    treeDataProvider: new ChatThreadsProvider(chatEngine)
  });

  chatEngine.registerListener({
    messageListener: async (data) => {
      if (vscode.workspace.getConfiguration('fbchat').get('showNotifications') === false || isMuted === true) {
        return;
      }
      if (chatEngine.isCurrentuser(data.senderID)) {
        return;
      }

      const muteOption = {
        title: 'Mute'
      };
      const replyOption = {
        title: 'Reply'
      };

      const showReply = await vscode.window.showInformationMessage(`${data.senderName}: "${data.body}"`, muteOption, replyOption);
      if (!showReply) {
        return;
      }

      if (showReply === replyOption) {
        vscode.commands.executeCommand('fbchat.reply', data.threadID);
      } else {
        vscode.commands.executeCommand('fbchat.mute');
      }

    },
    resetListener: () => {}
  });

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "fbchat" is now active!');

  let openThread = vscode.commands.registerCommand('fbchat.openThread', async (threadID: string) => {
    let uri = vscode.Uri.parse('fbchat:' + threadID);
    let doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
  });

  let openChat = vscode.commands.registerCommand('fbchat.openChat', async () => {
    if (!chatEngine.isActive()) {
      if (!chatEngine.isSavedLogin()) {
        vscode.window.showErrorMessage("No FB user logged in. Run commmand FBChat: Login to setup");
          return;
      }
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

  let reply = vscode.commands.registerCommand('fbchat.reply', async (threadID?: string) => {
    if (!threadID) {
      if (!vscode.window.activeTextEditor) {
        return; // no editor
      }
      let { document } = vscode.window.activeTextEditor;
      if (document.uri.scheme !== 'fbchat') {
        return; // not my scheme
      }

      threadID = document.uri.path;
    }

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

  let sendMessage = vscode.commands.registerCommand('fbchat.sendTextAsMessage', async (resource) => {
    if (!vscode.window.activeTextEditor || !resource) {
      return;
    }

    const text = vscode.window.activeTextEditor.document.getText(vscode.window.activeTextEditor.selection);

    if (!text) {
      return;
    }

    if (!chatEngine.isActive()) {
      if (!chatEngine.isSavedLogin()) {
        vscode.window.showErrorMessage("No FB user logged in. Run commmand FBChat: Login to setup");
          return;
      }
      await chatEngine.start();
    }

    const threadsPromise = chatEngine.getThreads().then(threads => threads.map(thread => ({
      label: thread.name,
      id: thread.id
    })));

    const selected = await vscode.window.showQuickPick(threadsPromise);

    if (!selected) {
      return;
    }

    await chatEngine.sendMessage(text, selected.id);
  });

  let mute = vscode.commands.registerCommand('fbchat.mute', async () => {
    isMuted = true;
  });

  let unmute = vscode.commands.registerCommand('fbchat.unmute', async () => {
    isMuted = false;
  });

  let login = vscode.commands.registerCommand('fbchat.login', async () => {
    if (chatEngine.isActive() || chatEngine.isSavedLogin()) {
      return;
    }

    await chatEngine.setupLogin();
  });

  context.subscriptions.push(documnetProvider);
  context.subscriptions.push(sendMessage);
  context.subscriptions.push(reply);
  context.subscriptions.push(login);
  context.subscriptions.push(logout);
  context.subscriptions.push(openChat);
  context.subscriptions.push(openThread);
  context.subscriptions.push(mute);
  context.subscriptions.push(unmute);
}

// this method is called when your extension is deactivated
export function deactivate() { }
