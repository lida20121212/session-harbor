import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api, isPreview, type Account, type Dashboard, type EnvironmentReport } from './lib/api';

function Icon({ name, size = 20 }: { name: 'harbor' | 'accounts' | 'history' | 'device' | 'plus' | 'arrow' | 'close' | 'check'; size?: number }) {
  const paths = {
    harbor: <><path d="M12 3v14M8 7h8M4 13c0 5 3 8 8 8s8-3 8-8M2 15l2-2 2 2M18 15l2-2 2 2" /><circle cx="12" cy="4" r="2" /></>,
    accounts: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5" /></>,
    history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" /></>,
    device: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M4 12h16M14 6l6 6-6 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Dialog({ title, children, onClose, busy, returnFocus }: { title: string; children: ReactNode; onClose: () => void; busy: boolean; returnFocus: HTMLElement | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      // Wait for unmount; StrictMode may immediately open this dialog again.
      queueMicrotask(() => {
        if (!document.querySelector('dialog[open]')) returnFocus?.focus();
      });
    };
  }, [returnFocus]);
  return <dialog ref={ref} className="dialog" aria-labelledby="dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" type="button" aria-label="关闭对话框" onClick={onClose} disabled={busy}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
function date(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

export default function App() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentReport | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'accounts' | 'history' | 'environment'>('accounts');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<Account | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const dialogTrigger = useRef<HTMLElement | null>(null);

  async function refresh() {
    const next = await api.getDashboard();
    setDashboard(next);
    setSelected((current) => next.accounts.some((item) => item.id === current) ? current : next.accounts[0]?.id ?? null);
  }
  async function load() {
    setLoading(true); setError('');
    try { await refresh(); } catch (cause) { setError(message(cause)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const account = dashboard?.accounts.find((item) => item.id === selected);
  const activeHandoff = dashboard?.handoffs.find((item) => item.targetAccountId === selected && item.status === 'blocked');

  function openEditor(value: Account | 'new') {
    dialogTrigger.current = document.activeElement as HTMLElement | null;
    setName(value === 'new' ? '' : value.name); setDescription(value === 'new' ? '' : value.description);
    setFormError(''); setEditor(value);
  }
  function openDelete(value: Account) {
    dialogTrigger.current = document.activeElement as HTMLElement | null;
    setFormError(''); setDeleting(value);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy || !editor) return;
    setBusy(true); setFormError('');
    try {
      const result = await api.saveAccount({ id: editor === 'new' ? null : editor.id, name, description });
      await refresh(); setSelected(result.id); setEditor(null); setNotice('账号档案已保存。登录状态尚未核验。');
    } catch (cause) { setFormError(message(cause)); } finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true); setFormError('');
    try { await api.deleteAccount(deleting.id); await refresh(); setDeleting(null); setNotice('本地档案已删除，官方客户端未受影响。'); }
    catch (cause) { setFormError(message(cause)); } finally { setBusy(false); }
  }
  async function handoff() {
    if (!account || busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await api.prepareHandoff(account.id); await refresh(); setNotice('预检已记录：Desktop 身份与原会话接续待验证，尚未切换账号。'); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }
  async function cancel(id: string) {
    setBusy(true); setError('');
    try { await api.cancelHandoff(id); await refresh(); setNotice('预检已取消。'); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }
  async function inspect() {
    setDetecting(true); setError('');
    try { setEnvironment(await api.inspectEnvironment()); }
    catch (cause) { setError(message(cause)); } finally { setDetecting(false); }
  }

  const environmentPanel = <>
    <div className="section-heading"><div><span className="eyebrow">LOCAL ENVIRONMENT</span><h2>本机环境</h2></div><button className="button secondary compact" onClick={inspect} disabled={detecting}>{detecting ? '检测中…' : environment ? '重新检测' : '检测环境'}</button></div>
    <p className="muted">只检查安装位置。检测到应用不代表已经登录，也不能证明会话能够接续。</p>
    <div className="environment-list">{(['desktop', 'cli'] as const).map((key) => <div className="environment-row" key={key}><span className="environment-icon"><Icon name="device" /></span><div><strong>{key === 'desktop' ? 'Claude Desktop' : 'Claude Code CLI'}</strong><p>{environment?.[key].detail ?? '尚未检测本机安装情况'}</p></div><span className={`badge ${environment?.[key].status === 'detected' ? 'detected' : ''}`}>{!environment ? '未检测' : ({ detected: '已检测到', not_detected: '未检测到', unsupported: '暂不支持', unknown: '未知' })[environment[key].status]}</span></div>)}</div>
    {environment && <p className="footnote">最近检测 {date(environment.checkedAt)} · {environment.platform}</p>}
  </>;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setView('accounts'); }} aria-label="Session Harbor 账号工作台"><span className="brand-mark"><Icon name="harbor" size={26} /></span><span>SESSION<br /><b>HARBOR</b></span></a>
      <div className="sidebar-label">个人工作空间</div>
      <nav aria-label="主导航">
        <button className={view === 'accounts' ? 'nav-item active' : 'nav-item'} onClick={() => setView('accounts')} aria-current={view === 'accounts' ? 'page' : undefined}><Icon name="accounts" />账号工作台<span className="nav-count">{dashboard?.accounts.length ?? '—'}</span></button>
        <button className={view === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => setView('history')} aria-current={view === 'history' ? 'page' : undefined}><Icon name="history" />接续记录</button>
        <button className={view === 'environment' ? 'nav-item active' : 'nav-item'} onClick={() => setView('environment')} aria-current={view === 'environment' ? 'page' : undefined}><Icon name="device" />本机环境</button>
      </nav>
      <div className="sidebar-bottom"><span className="prototype-dot" />开发原型 <span className="version">v0.1.0</span><p>专注 Claude Desktop · Code</p></div>
    </aside>
    <main className="main">
      <header className="topbar"><span>工作空间 <span className="breadcrumb">/</span> {view === 'accounts' ? '账号工作台' : view === 'history' ? '接续记录' : '本机环境'}</span><span className="local-label"><span />仅本机数据</span></header>
      {isPreview && <div className="preview-banner"><strong>浏览器预览</strong><span>档案与记录仅在当前页面内暂存，刷新后清空。请在桌面应用中使用本地持久化存储。</span></div>}
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">CLAUDE DESKTOP / CODE</div><h1>{view === 'accounts' ? '让每个账号，各就其位。' : view === 'history' ? '接续记录' : '检查你的开发环境'}</h1><p>{view === 'accounts' ? '整理自己的账号档案，检查接续条件。每一步状态都有据可查。' : view === 'history' ? '保留最近 20 条预检记录，查看阻塞原因与处理状态。' : '本机安装信息与 Desktop 登录身份分别核验。'}</p></div>{view === 'accounts' && <button className="button primary" onClick={() => openEditor('new')} disabled={loading || !dashboard}><Icon name="plus" size={18} />添加账号档案</button>}</div>
        {error && <div className="alert error" role="alert"><span>{error}</span><button className="text-button" onClick={load} disabled={loading}>重新加载</button></div>}
        {notice && <div className="alert notice" role="status"><span>{notice}</span><button className="icon-button" onClick={() => setNotice('')} aria-label="关闭提示"><Icon name="close" size={16} /></button></div>}
        {loading ? <div className="loading-state" role="status">正在读取本地工作空间…</div> : view === 'accounts' ? <>
          <div className="workspace-grid">
            <section className="panel accounts-panel" aria-labelledby="accounts-title">
              <div className="panel-heading"><h2 id="accounts-title">账号档案 <span className="count">{dashboard?.accounts.length ?? 0}</span></h2><span className="muted small">本地别名</span></div>
              {dashboard?.accounts.length ? <div className="account-list">{dashboard.accounts.map((item) => <button key={item.id} className={`account-row ${selected === item.id ? 'selected' : ''}`} onClick={() => setSelected(item.id)} aria-pressed={selected === item.id}><span className="account-avatar">{Array.from(item.name)[0]?.toLocaleUpperCase()}</span><span className="account-copy"><strong>{item.name}</strong><span>{item.description || '未添加备注'}</span></span><span className="identity-status"><span />身份未核验</span><Icon name="arrow" size={17} /></button>)}</div> : <div className="empty-accounts"><div className="berth-art" aria-hidden="true"><span /><span /><span /><Icon name="harbor" size={36} /></div><h3>为你的第一个账号留个位置</h3><p>添加一个易于辨认的别名。<br />无需密码，也不会改变 Claude 当前登录状态。</p><button className="button secondary" onClick={() => openEditor('new')} disabled={!dashboard}><Icon name="plus" size={17} />添加账号档案</button></div>}
              <div className="panel-note">档案用于区分账号；实际登录身份需要在 Desktop 中核验。</div>
            </section>
            <section className="panel handoff-panel" aria-labelledby="handoff-title">
              <div className="panel-heading"><h2 id="handoff-title">接续检查</h2><span className="badge amber">适配待验证</span></div>
              <div className="handoff-body"><span className="eyebrow">目标账号</span><h3 className="target-name">{account?.name ?? '尚未选择账号'}</h3><p className="muted">{account ? '预检会记录当前阻塞原因，不会更改客户端的登录状态。' : '先添加或选择一个账号档案，再记录接续预检。'}</p>
                <ol className="checklist"><li className={account ? 'complete' : ''}><span className="step-marker">{account ? <Icon name="check" size={13} /> : '1'}</span><div><strong>选择本地账号档案</strong><small>{account ? '已选择 · 尚未核验身份' : '等待选择'}</small></div></li><li><span className="step-marker">2</span><div><strong>核验 Desktop 实际身份</strong><small>官方登录路径待验证</small></div></li><li><span className="step-marker">3</span><div><strong>核验原会话与工作区</strong><small>上下文、worktree 与在途任务待验证</small></div></li></ol>
                {activeHandoff && <div className="blocked-note"><strong>接续预检已阻塞</strong><p>{activeHandoff.reason}</p><button className="text-button" onClick={() => cancel(activeHandoff.id)} disabled={busy}>取消这次预检</button></div>}
                <button className="button primary full" onClick={handoff} disabled={!account || busy || !!activeHandoff}>{busy ? '处理中…' : activeHandoff ? '等待 Desktop 适配验证' : '记录接续预检'}{!activeHandoff && <Icon name="arrow" size={17} />}</button>
                <p className="footnote centered">原会话接续尚未实现，当前不会执行账号切换。</p>
              </div>
            </section>
          </div>
          {account && <section className="selected-detail"><div><strong>{account.name}</strong><span>创建于 {date(account.createdAt)}</span></div><div><button className="text-button" onClick={() => openEditor(account)} disabled={busy}>编辑档案</button><button className="text-button danger" onClick={() => openDelete(account)} disabled={busy}>删除档案</button></div></section>}
          <section className="usage-panel"><div className="usage-intro"><span className="eyebrow">SUBSCRIPTION USAGE</span><h2>订阅用量</h2><p>可靠的数据，才能做可靠的决定。</p></div><div className="usage-value"><strong>未知<span>unknown</span></strong><span>剩余额度</span></div><div className="usage-explanation"><span className="badge">数据源待验证</span><p>尚未接入经验证的订阅用量来源。<br />不会将本地估算当作剩余额度。</p></div><div className="usage-observed"><span>观测时间</span><strong>—</strong><span>重置时间</span><strong>—</strong></div></section>
          <section className="panel environment-panel">{environmentPanel}</section>
        </> : view === 'environment' ? <section className="panel environment-panel">{environmentPanel}</section> : <section className="panel history-panel"><div className="panel-heading"><h2>最近预检</h2><span className="muted small">{dashboard?.handoffs.length ?? 0} 条记录</span></div>{dashboard?.handoffs.length ? <div className="history-list">{dashboard.handoffs.map((item) => <article className="history-row" key={item.id}><span className="history-symbol"><Icon name="history" /></span><div className="history-copy"><strong>{item.targetName}</strong><p>{item.reason}</p><time dateTime={item.createdAt}>{date(item.createdAt)}</time></div><span className={`badge ${item.status === 'blocked' ? 'amber' : ''}`}>{item.status === 'blocked' ? '已阻塞' : '已取消'}</span>{item.status === 'blocked' && <button className="text-button" onClick={() => cancel(item.id)} disabled={busy}>取消预检</button>}</article>)}</div> : <div className="empty-history"><Icon name="history" size={32} /><h3>还没有接续预检</h3><p>在账号工作台中选择账号并记录预检，结果会保留在这里。</p><button className="button secondary" onClick={() => setView('accounts')}>返回账号工作台</button></div>}</section>}
        <footer className="page-footer"><span>SESSION HARBOR <span className="footer-divider">/</span> 一个专注 Claude 的本地工作台</span><span>独立开源项目 · 非 Anthropic 官方产品</span></footer>
      </div>
    </main>
    {editor && <Dialog returnFocus={dialogTrigger.current} title={editor === 'new' ? '添加账号档案' : '编辑账号档案'} busy={busy} onClose={() => setEditor(null)}><form onSubmit={save}><p className="dialog-description">用别名区分你自己的账号。此处不会登录 Claude，请勿填写密码或令牌。</p><label className="field">账号别名<span className="field-hint">1–40 个字符</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：日常开发" required disabled={busy} /></label><label className="field">备注 <span className="field-hint">选填，最多 160 个字符</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="例如：个人项目使用" rows={3} disabled={busy} /></label>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="dialog-actions"><button className="button secondary" type="button" onClick={() => setEditor(null)} disabled={busy}>取消</button><button className="button primary" type="submit" disabled={busy}>{busy ? '保存中…' : '保存档案'}</button></div></form></Dialog>}
    {deleting && <Dialog returnFocus={dialogTrigger.current} title="删除本地账号档案" busy={busy} onClose={() => setDeleting(null)}><p className="dialog-description">确定删除“{deleting.name}”？相关待处理预检将取消，历史记录保留。Claude 的登录状态与会话不受影响。</p>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="dialog-actions"><button className="button secondary" onClick={() => setDeleting(null)} disabled={busy}>保留档案</button><button className="button destructive" onClick={remove} disabled={busy}>{busy ? '删除中…' : '删除档案'}</button></div></Dialog>}
  </div>;
}
