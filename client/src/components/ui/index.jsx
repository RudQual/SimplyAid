import { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';
import { Link } from 'react-router-dom';
import { X, Search, ChevronLeft, ChevronRight, AlertTriangle, Inbox, RefreshCw, ArrowLeft } from 'lucide-react';
import { labelize, toneFor } from '../../utils/format';

/* ─── Page structure ─────────────────────────────────────────────────────── */

export const PageHeader = ({ title, subtitle, eyebrow, actions, back }) => (
  <div className="page-header">
    <div>
      {back && <Link to={back.to} className="back-link"><ArrowLeft size={14} /> {back.label}</Link>}
      {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

export const Card = ({ title, subtitle, actions, children, flush = false, className = '', icon: Icon }) => (
  <section className={`card ${flush ? 'card-flush' : ''} ${className}`}>
    {(title || actions) && (
      <div className="card-header">
        <div>
          {title && <h3 className="card-title">{Icon && <Icon size={17} className="muted" />}{title}</h3>}
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="row wrap">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);

/* ─── Data display ───────────────────────────────────────────────────────── */

export const StatCard = ({ label, value, icon: Icon, tone = 'blue', meta, to, onClick, loading }) => {
  const content = (
    <>
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        {Icon && <span className={`stat-icon tone-${tone}`}><Icon size={18} /></span>}
      </div>
      {loading ? <div className="skeleton" style={{ height: 30, width: '45%' }} /> : <div className="stat-value">{value}</div>}
      {meta && <div className="stat-meta">{meta}</div>}
    </>
  );
  if (to) return <Link to={to} className="stat-card">{content}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="stat-card" style={{ textAlign: 'left' }}>{content}</button>;
  return <div className="stat-card">{content}</div>;
};

/** Badge whose colour follows the status value (see utils/format toneFor). */
export const StatusBadge = ({ value, label, dot = true, size }) => {
  if (!value) return null;
  return (
    <span className={`badge badge-${toneFor(value)} ${dot ? 'badge-dot' : ''} ${size === 'lg' ? 'badge-lg' : ''}`}>
      {label || labelize(value)}
    </span>
  );
};

export const ProgressBar = ({ value, tone, height }) => {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const auto = tone || (pct >= 100 ? 'green' : pct >= 60 ? 'amber' : 'red');
  return <div className={`progress ${auto}`} style={height ? { height } : undefined}><span style={{ width: `${pct}%` }} /></div>;
};

export const ScoreRing = ({ score = 0, size = 120, stroke = 10, label = 'score' }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 90 ? 'var(--success-600)' : pct >= 70 ? 'var(--warning-600)' : 'var(--danger-600)';
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--slate-150)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="score-ring-value"><strong style={{ color }}>{pct}%</strong><span>{label}</span></div>
    </div>
  );
};

/* ─── Feedback ───────────────────────────────────────────────────────────── */

export const EmptyState = ({ icon: Icon = Inbox, title, description, action }) => (
  <div className="empty-state">
    <div className="empty-state-icon"><Icon size={24} /></div>
    {title && <h3>{title}</h3>}
    {description && <p>{description}</p>}
    {action}
  </div>
);

export const ErrorState = ({ error, onRetry }) => (
  <div className="empty-state">
    <div className="empty-state-icon tone-red"><AlertTriangle size={24} /></div>
    <h3>Something went wrong</h3>
    <p>{error || 'The data could not be loaded.'}</p>
    {onRetry && <button className="btn btn-secondary btn-sm" onClick={onRetry}><RefreshCw size={14} /> Try again</button>}
  </div>
);

export const Skeleton = ({ width = '100%', height = 14, style }) => <div className="skeleton" style={{ width, height, ...style }} />;

export const SkeletonRows = ({ rows = 5, cols = 4 }) => (
  <div style={{ padding: '8px 20px' }}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="row" style={{ gap: 16, padding: '12px 0', borderBottom: '1px solid var(--slate-150)' }}>
        {Array.from({ length: cols }).map((__, j) => <Skeleton key={j} width={j === 0 ? '28%' : `${16 + ((i + j) % 3) * 6}%`} />)}
      </div>
    ))}
  </div>
);

export const SkeletonStats = ({ count = 4 }) => (
  <div className="stat-grid">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="stat-card"><Skeleton width="50%" /><Skeleton width="35%" height={28} /><Skeleton width="60%" height={10} /></div>
    ))}
  </div>
);

export const Spinner = ({ size = 'md', light }) => <span className={`spinner ${size === 'sm' ? 'spinner-sm' : ''} ${light ? 'spinner-light' : ''}`} />;

export const PageLoader = () => <div className="page-loader"><div className="spinner" /></div>;

/* ─── Inputs ─────────────────────────────────────────────────────────────── */

export const SearchInput = ({ value, onChange, placeholder = 'Search…', delay = 300, autoFocus }) => {
  const [local, setLocal] = useState(value || '');
  const first = useRef(true);
  useEffect(() => { setLocal(value || ''); }, [value]);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const t = setTimeout(() => { if (local !== value) onChange(local); }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);
  return (
    <div className="input-icon">
      <Search size={16} />
      <input type="search" value={local} placeholder={placeholder} onChange={(e) => setLocal(e.target.value)} autoFocus={autoFocus} aria-label={placeholder} />
    </div>
  );
};

export const Field = ({ label, required, hint, error, children, className = '' }) => (
  <div className={`form-group ${className}`}>
    {label && <label className="form-label">{label}{required && <span className="req">*</span>}</label>}
    {children}
    {error ? <span className="form-error">{error}</span> : hint ? <span className="form-hint">{hint}</span> : null}
  </div>
);

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs" role="tablist">
    {tabs.map((t) => (
      <button key={t.value} role="tab" aria-selected={value === t.value} className={`tab ${value === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
        {t.icon && <t.icon size={15} />}
        {t.label}
        {t.count !== undefined && <span className="count">{t.count}</span>}
      </button>
    ))}
  </div>
);

export const Segmented = ({ options, value, onChange }) => (
  <div className="segmented">
    {options.map((o) => (
      <button type="button" key={o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
    ))}
  </div>
);

export const Pagination = ({ page, pages, total, limit, onChange }) => {
  if (!total) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="pagination">
      <span>Showing <strong>{from}–{to}</strong> of <strong>{total}</strong></span>
      <div className="pagination-buttons">
        <button className="btn btn-secondary btn-sm btn-icon" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
        <span>Page {page} of {pages}</span>
        <button className="btn btn-secondary btn-sm btn-icon" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
};

/* ─── Overlays ───────────────────────────────────────────────────────────── */

export const Modal = ({ open, onClose, title, description, children, footer, size = 'md', busy = false }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose, busy]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{title}</h2>
            {description && <p className="modal-description">{description}</p>}
          </div>
          <button className="modal-close" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

const ConfirmContext = createContext(null);

/** Provides `confirm({ title, message, confirmLabel, tone })` returning a Promise<boolean>. */
export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const close = (result) => { state?.resolve(result); setState(null); };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => close(false)}
        title={state?.title || 'Are you sure?'}
        size="sm"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => close(false)}>{state?.cancelLabel || 'Cancel'}</button>
            <button className={`btn ${state?.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
              {state?.confirmLabel || 'Confirm'}
            </button>
          </>
        )}
      >
        <p className="muted" style={{ fontSize: '0.92rem' }}>{state?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => useContext(ConfirmContext);
