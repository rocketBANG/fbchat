import * as vscode from 'vscode';
import { ChatEngine } from './chat-engine';

export class FBChatDocumentProvider implements vscode.TextDocumentContentProvider {
  private chatLog: { [threadId: string]: string } = {};

  constructor(private chatEngine: ChatEngine) {
    chatEngine.registerListener({
      messageListener: (data) => {
        this.addMessage({
          message: data.body,
          senderName: this.chatEngine.isCurrentuser(data.senderID) ? 'You' : data.senderName,
          threadId: data.threadID
        });
        this.onDidChangeEmitter.fire(vscode.Uri.parse("fbchat:" + data.threadID));
      },
      resetListener: () => {
        this.chatLog = {};
      }
    });
  }

  private addMessage({ threadId, senderName, message }: { threadId: string; senderName: string; message: string; }) {
    const relevantChatLog = this.chatLog[threadId];
    const newLine = relevantChatLog ? '\n' : '';

    this.chatLog[threadId] = `${relevantChatLog}${newLine}${senderName}: "${message}"`;
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const threadId = uri.path;

    if (this.chatLog[threadId] === undefined) {
      this.chatLog[threadId] = '';

      const history = await this.chatEngine.getThreadHistory(threadId);

      const users: { [userID: string]: string } = {};

      await Promise.all(history.map(async h => users[h.senderID] = await this.chatEngine.getUserName(h.senderID)));

      history.forEach(h => {
        this.addMessage({
          message: h.body,
          senderName: this.chatEngine.isCurrentuser(h.senderID) ? 'You' : users[h.senderID],
          threadId: h.threadID,
        });
      });
    }

    return this.chatLog[threadId];
  }

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;
};