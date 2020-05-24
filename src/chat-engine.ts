import * as fs from "fs";
import login = require("facebook-chat-api");
import * as vscode from 'vscode';

// Reuben - 100003265525475
// Fake - 100051661898412

export interface ChatHistory {
  type: string;
  attachments: any[];
  body: string;
  isGroup: boolean;
  messageID: string;
  senderID: string;
  threadID: string;
  timestamp: string;
  mentions: any;
  isUnread: boolean;
  messageReactions: any[];
  isSponsored: boolean;
}


export interface ChatListenerData {
  body: string,
  senderName: string,
  senderID: string,
  threadID: string
}

export type ChatListener = {
  resetListener: () => void;
  messageListener: (data: ChatListenerData) => void;
};

const settingsKey = "fbchatAppState";

export class ChatEngine {
  private api: any = undefined;
  private userInfo: { [userID: string]: any } = {};
  private messageRecievedListener: (() => void) | undefined = undefined;

  constructor(private state: vscode.Memento) {
  }

  private listeners: ChatListener[] = [];

  setupLogin = () => new Promise(async resolve => {
    const email = await vscode.window.showInputBox({
      prompt: "Enter email"
    });

    if (!email) {
      return;
    }

    const password = await vscode.window.showInputBox({
      prompt: "Enter password",
      password: true
    });

    if (!password) {
      return;
    }

    login({ email, password }, async (err, api) => {
      if (err) {
        switch (err.error) {
          case 'login-approval':
            const fa2Code = await vscode.window.showInputBox({
              prompt: "Enter 2fa code"
            });
            if (fa2Code) {
              err.continue(fa2Code);
            }
            break;
          default:
            vscode.window.showErrorMessage("Incorrect username or password");
        }
        return;
      }


      this.state.update(settingsKey, api.getAppState());

      await this.setupApiListening(api);
      resolve(api);
    });
  });

  private activateApi = (callback) => {
    let savedCreds;
    try {
      savedCreds = this.state.get("fbchatAppState");
    }
    catch {
      savedCreds = undefined;
    }

    login({ appState: savedCreds }, async (err, api) => {
      if (!err) {
        callback(api);
        return;
      }

      return callback(null);
    });

  };

  isActive = () => this.api !== undefined;
  isSavedLogin = () => !!this.state.get(settingsKey);

  logout = () => new Promise((resolve, reject) => {
    if (this.api) {
      this.api.logout((err) => {
      });
    }

    this.state.update(settingsKey, undefined);
    this.api = undefined;
    if (this.messageRecievedListener) {
      this.messageRecievedListener();
    }

    this.listeners.forEach(l => l.resetListener());

    resolve();
  });

  isCurrentuser = (userID: string) => this.api.getCurrentUserID() === userID;

  sendMessage = async (message: string, threadID: string) => {
    this.api.sendMessage(message, threadID);

    const senderInfo = await this.getUserInfo(this.api.getCurrentUserID());

    this.listeners.forEach(l => l.messageListener({
      body: message,
      senderName: senderInfo.name,
      threadID: threadID,
      senderID: this.api.getCurrentUserID()
    }));

  };


  getThreads = () => new Promise<{ name: string, id: string }[]>((resolve, reject) => {
    this.api.getThreadList(10, null, [], (err, list: any[]) => {
      if (err) {
        reject(err);
      }

      resolve(list.map(l => ({
        name: l.name,
        id: l.threadID
      })));
    });
  });

  getThreadHistory = (threadID: string) => new Promise<ChatHistory[]>((resolve, reject) => {
    this.api.getThreadHistory(threadID, 50, undefined, (err, history: ChatHistory[]) => {
      if (err) {
        reject(err);
      }


      resolve(history);

    });
  });

  registerListener = (listener: ChatListener) => {
    this.listeners.push(listener);
  };

  private getUserInfo = (userID) => new Promise<{ name: string }>(resolve => {
    if (this.userInfo[userID]) {
      return resolve(this.userInfo[userID]);
    }

    this.api.getUserInfo(userID, (err, userInfoResult) => {
      if (err) {
        console.log(err);
        return;
      }
      const firstUser = userInfoResult[Object.keys(userInfoResult)[0]];
      resolve(firstUser);
    });
  });

  getUserName = async (userID) => {
    return (await this.getUserInfo(userID)).name;
  };

  private setupApiListening = (api) => new Promise(resolve => {
    this.listeners.forEach(l => l.resetListener());

    api.setOptions({
      logLevel: "silent"
    });

    this.api = api;
    resolve();

    api.setOptions({ listenEvents: true });

    this.messageRecievedListener = api.listenMqtt(async (err, event) => {
      if (err) {
        return console.error(err);
      }

      api.markAsRead(event.threadID, (err) => {
        if (err) { console.error(err); }
      });

      switch (event.type) {
        case "message":
          const senderInfo = await this.getUserInfo(event.senderID);

          this.listeners.forEach(l => l.messageListener({
            body: event.body,
            senderName: senderInfo.name,
            threadID: event.threadID,
            senderID: event.senderID
          }));
          break;
        case "event":
          console.log("event", event);
          break;
      }
    });
  });

  start = () => new Promise(resolve => {
    this.activateApi(async (api) => {
      await this.setupApiListening(api);
      return resolve();
    });
  });

}
