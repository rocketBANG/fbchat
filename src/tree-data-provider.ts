import * as vscode from 'vscode';
import { ChatEngine } from './chat-engine';

export class ChatThreadsProvider implements vscode.TreeDataProvider<ChatThreadItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ChatThreadItem | undefined> = new vscode.EventEmitter<ChatThreadItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<ChatThreadItem | undefined> = this._onDidChangeTreeData.event;

  constructor(private chatEngine: ChatEngine) {
    chatEngine.registerListener({
      messageListener: () => {},
      resetListener: () => this.refresh()
    });
  }

  getTreeItem(element: ChatThreadItem): vscode.TreeItem {
    return element;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async getChildren(element?: ChatThreadItem): Promise<ChatThreadItem[]> {
    if (!this.chatEngine.isActive()) {
      if (!this.chatEngine.isSavedLogin()) {
        return [];
      }
      await this.chatEngine.start();
    }

    // Return empty children
    if (element) {
      return [];
    }

    const threads = await this.chatEngine.getThreads();

    return threads.map(t => new ChatThreadItem(t.name, vscode.TreeItemCollapsibleState.None, t.id));
  }
}

class ChatThreadItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    private readonly threadID: string,
  ) {
    super(label, collapsibleState);
  }

  command: vscode.Command = {
    command: 'fbchat.openThread',
    title: 'Open',
    arguments: [this.threadID],
  };

  get tooltip(): string {
    return `${this.label}`;
  }

  get description(): string {
    return '';
  }

  // iconPath = {
  //   light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
  //   dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  // };
}