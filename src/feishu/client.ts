import * as Lark from '@larksuiteoapi/node-sdk';
import type { FeishuAccount } from './accounts.js';

const clients = new Map<string, LarkClient>();

export class LarkClient {
  private account: FeishuAccount;
  private _sdk: Lark.Client | null = null;
  private _wsClient: Lark.WSClient | null = null;

  constructor(account: FeishuAccount) {
    this.account = account;
  }

  static fromAccount(account: FeishuAccount): LarkClient {
    const existing = clients.get(account.accountId);
    if (existing) {
      // If credentials changed, drop the stale instance
      if (existing.account !== account) {
        existing.disconnect();
        clients.delete(account.accountId);
      } else {
        return existing;
      }
    }
    const client = new LarkClient(account);
    clients.set(account.accountId, client);
    return client;
  }

  static listActive(): IterableIterator<LarkClient> {
    return clients.values();
  }

  requireCredentials(): { appId: string; appSecret: string } {
    const { appId, appSecret } = this.account;
    if (!appId || !appSecret) {
      throw new Error(`Missing app credentials for account ${this.account.accountId}`);
    }
    return { appId, appSecret };
  }

  private resolveDomain(): Lark.Domain | string {
    switch (this.account.brand) {
      case 'lark':
        return Lark.Domain.Lark;
      case 'feishu':
      default:
        return Lark.Domain.Feishu;
    }
  }

  get sdk(): Lark.Client {
    if (!this._sdk) {
      const { appId, appSecret } = this.requireCredentials();
      this._sdk = new Lark.Client({
        appId,
        appSecret,
        appType: Lark.AppType.SelfBuild,
        domain: this.resolveDomain(),
      });
    }
    return this._sdk;
  }

  get botOpenId(): Promise<string | undefined> {
    return this.probe().then((info) => info?.openId);
  }

  async probe(): Promise<{ openId: string; name: string } | undefined> {
    try {
      const sdk = this.sdk as unknown as {
        request: (opts: { method: string; url: string }) => Promise<{
          data?: {
            bot?: {
              open_id?: string;
              name?: string;
            };
          };
        }>;
      };
      const res = await sdk.request({ method: 'GET', url: '/open-apis/bot/v3/info/' });
      const bot = res.data?.bot;
      if (bot?.open_id) {
        return { openId: bot.open_id, name: bot.name ?? 'ZClaw' };
      }
    } catch (err) {
      console.warn(`[lark-client:${this.account.accountId}] probe failed:`, err);
    }
    return undefined;
  }

  async startWS(handlers: Record<string, (data: unknown) => void | Promise<void>>, abortSignal?: AbortSignal): Promise<void> {
    const dispatcher = new Lark.EventDispatcher({
      encryptKey: this.account.encryptKey ?? '',
      verificationToken: this.account.verificationToken ?? '',
    });

    for (const [event, handler] of Object.entries(handlers)) {
      dispatcher.register({ [event]: handler } as unknown as Record<string, (data: unknown) => void | Promise<void>>);
    }

    const { appId, appSecret } = this.requireCredentials();

    if (this._wsClient) {
      try {
        this._wsClient.close({ force: true });
      } catch {
        // ignore
      }
      this._wsClient = null;
    }

    this._wsClient = new Lark.WSClient({
      appId,
      appSecret,
      domain: this.resolveDomain(),
      loggerLevel: Lark.LoggerLevel.info,
    });

    // Patch SDK so card action callbacks (type="card") are routed through dispatcher
    const wsClientAny = this._wsClient as unknown as {
      handleEventData: (data: {
        headers?: Array<{ key: string; value: string }>;
      }) => Promise<unknown>;
    };
    const origHandleEventData = wsClientAny.handleEventData.bind(wsClientAny);
    wsClientAny.handleEventData = (data: { headers?: Array<{ key: string; value: string }> }) => {
      const msgType = data.headers?.find((h) => h.key === 'type')?.value;
      if (msgType === 'card') {
        const patchedData = {
          ...data,
          headers: data.headers?.map((h) => (h.key === 'type' ? { ...h, value: 'event' } : h)),
        };
        return origHandleEventData(patchedData);
      }
      return origHandleEventData(data);
    };

    return new Promise<void>((resolve, reject) => {
      if (abortSignal?.aborted) {
        this.disconnect();
        resolve();
        return;
      }

      abortSignal?.addEventListener(
        'abort',
        () => {
          this.disconnect();
          resolve();
        },
        { once: true },
      );

      try {
        void this._wsClient!.start({ eventDispatcher: dispatcher });
      } catch (err) {
        this.disconnect();
        reject(err);
      }
    });
  }

  disconnect(): void {
    if (this._wsClient) {
      try {
        this._wsClient.close({ force: true });
      } catch {
        // ignore
      }
      this._wsClient = null;
    }
  }
}

export function disconnectAll(): void {
  for (const client of clients.values()) {
    client.disconnect();
  }
  clients.clear();
}
