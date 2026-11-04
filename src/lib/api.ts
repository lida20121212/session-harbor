import { invoke, isTauri } from '@tauri-apps/api/core';

export interface Account {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
export interface AccountInput { id: string | null; name: string; description: string }
export interface Usage {
  status: 'unknown';
  source: null;
  observedAt: null;
  remainingPercent: null;
  resetAt: null;
}
export interface Handoff {
  id: string;
  targetAccountId: string;
  targetName: string;
  status: 'blocked' | 'cancelled';
  reason: string;
  createdAt: string;
}
export interface Dashboard { accounts: Account[]; usage: Usage; handoffs: Handoff[] }
export interface Detection {
  status: 'detected' | 'not_detected' | 'unsupported' | 'unknown';
  detail: string;
}
export interface EnvironmentReport {
  platform: string;
  desktop: Detection;
  cli: Detection;
  checkedAt: string;
}
export interface HarborApi {
  getDashboard(): Promise<Dashboard>;
  saveAccount(input: AccountInput): Promise<Account>;
  deleteAccount(id: string): Promise<void>;
  inspectEnvironment(): Promise<EnvironmentReport>;
  prepareHandoff(targetAccountId: string): Promise<Handoff>;
  cancelHandoff(id: string): Promise<void>;
}

export const isPreview = !isTauri();
const unknownUsage = (): Usage => ({
  status: 'unknown', source: null, observedAt: null, remainingPercent: null, resetAt: null,
});

/** Browser-only, ephemeral UI preview. Never used as a fallback for native IPC failures. */
export function createPreviewApi(): HarborApi {
  let accounts: Account[] = [];
  const handoffs: Handoff[] = [];
  const clone = <T,>(value: T): T => structuredClone(value);
  return {
    async getDashboard() {
      return clone({ accounts, usage: unknownUsage(), handoffs: handoffs.slice(0, 20) });
    },
    async saveAccount(input) {
      if (/[\p{Cc}]/u.test(input.name + input.description)) throw new Error('名称和备注不能包含控制字符。');
      const name = input.name.trim();
      const description = input.description.trim();
      if (!name || [...name].length > 40) throw new Error('账号名称需要 1–40 个字符。');
      if ([...description].length > 160) throw new Error('备注最多 160 个字符。');
      if (accounts.some(a => a.id !== input.id && a.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('这个账号名称已存在。');
      }
      const existing = input.id === null ? undefined : accounts.find(a => a.id === input.id);
      if (input.id !== null && !existing) throw new Error('账号不存在，请刷新后重试。');
      const now = new Date().toISOString();
      const account = { id: existing?.id ?? crypto.randomUUID(), name, description,
        createdAt: existing?.createdAt ?? now, updatedAt: now };
      accounts = existing ? accounts.map(a => a.id === account.id ? account : a) : [...accounts, account];
      return clone(account);
    },
    async deleteAccount(id) {
      if (!accounts.some(a => a.id === id)) throw new Error('账号不存在。');
      accounts = accounts.filter(a => a.id !== id);
      for (const h of handoffs) {
        if (h.targetAccountId === id && h.status === 'blocked') {
          h.status = 'cancelled';
          h.reason = '目标账号档案已删除，未对 Desktop 执行任何操作。';
        }
      }
    },
    async inspectEnvironment() {
      const unknown: Detection = { status: 'unknown', detail: '浏览器预览无法检测本机安装，请在桌面应用中检查。' };
      return { platform: 'browser', desktop: { ...unknown }, cli: { ...unknown }, checkedAt: new Date().toISOString() };
    },
    async prepareHandoff(targetAccountId) {
      const account = accounts.find(a => a.id === targetAccountId);
      if (!account) throw new Error('目标账号不存在。');
      const existing = handoffs.find(h => h.targetAccountId === targetAccountId && h.status === 'blocked');
      if (existing) return clone(existing);
      const operation: Handoff = {
        id: crypto.randomUUID(), targetAccountId, targetName: account.name, status: 'blocked',
        reason: 'Desktop 实际身份、原会话接续和在途任务尚未验证。当前仅记录预检，不执行登录或切换。',
        createdAt: new Date().toISOString(),
      };
      handoffs.unshift(operation);
      return clone(operation);
    },
    async cancelHandoff(id) {
      const operation = handoffs.find(h => h.id === id);
      if (!operation || operation.status !== 'blocked') throw new Error('该预检不存在或已经取消。');
      operation.status = 'cancelled';
      operation.reason = '已在本地取消，未对 Desktop 执行任何操作。';
    },
  };
}

export const nativeApi: HarborApi = {
  getDashboard: () => invoke('get_dashboard'),
  saveAccount: input => invoke('save_account', { input }),
  deleteAccount: id => invoke('delete_account', { id }),
  inspectEnvironment: () => invoke('inspect_environment'),
  prepareHandoff: targetAccountId => invoke('prepare_handoff', { targetAccountId }),
  cancelHandoff: id => invoke('cancel_handoff', { id }),
};

export const api: HarborApi = isPreview ? createPreviewApi() : nativeApi;
