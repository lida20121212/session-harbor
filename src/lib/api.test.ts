import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => false }));
import { invoke } from '@tauri-apps/api/core';
import { createPreviewApi, nativeApi } from './api';

describe('browser preview boundaries', () => {
  let api = createPreviewApi();
  beforeEach(() => { api = createPreviewApi(); });
  it('keeps unknown usage and installation distinct from zero or authenticated', async () => {
    expect((await api.getDashboard()).usage.remainingPercent).toBeNull();
    expect((await api.inspectEnvironment()).desktop.status).toBe('unknown');
  });
  it('validates aliases and prevents duplicate or stale updates', async () => {
    const a = await api.saveAccount({ id: null, name: '  Work  ', description: '' });
    expect(a.name).toBe('Work');
    await expect(api.saveAccount({ id: null, name: 'work', description: '' })).rejects.toThrow();
    await expect(api.saveAccount({ id: 'missing', name: 'Other', description: '' })).rejects.toThrow();
    await expect(api.saveAccount({ id: a.id, name: 'x\ny', description: '' })).rejects.toThrow();
  });
  it('blocks handoff, cancels on deletion, and keeps the target snapshot', async () => {
    const a = await api.saveAccount({ id: null, name: 'Personal', description: '' });
    const h = await api.prepareHandoff(a.id);
    expect(h.status).toBe('blocked');
    expect((await api.prepareHandoff(a.id)).id).toBe(h.id);
    await api.deleteAccount(a.id);
    const dashboard = await api.getDashboard();
    expect(dashboard.accounts).toEqual([]);
    expect(dashboard.handoffs[0]).toMatchObject({ status: 'cancelled', targetName: 'Personal' });
    await expect(api.cancelHandoff(h.id)).rejects.toThrow();
  });
  it('does not persist preview data across instances or expose mutable records', async () => {
    await api.saveAccount({ id: null, name: 'Work', description: '' });
    (await api.getDashboard()).accounts[0].name = 'Changed';
    expect((await api.getDashboard()).accounts[0].name).toBe('Work');
    expect((await createPreviewApi().getDashboard()).accounts).toEqual([]);
  });
});

it('propagates native failures without pretending a preview operation succeeded', async () => {
  vi.mocked(invoke).mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(nativeApi.getDashboard()).rejects.toThrow('Storage unavailable');
  vi.mocked(invoke).mockResolvedValueOnce(undefined);
  await nativeApi.prepareHandoff('account-id');
  expect(invoke).toHaveBeenLastCalledWith('prepare_handoff', { targetAccountId: 'account-id' });
});
