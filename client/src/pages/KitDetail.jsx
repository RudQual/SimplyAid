import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Pencil, SearchCheck, QrCode, Trash2, Plus, Minus, PackagePlus, ChevronDown, ChevronRight, MoreHorizontal, CalendarX2,
  MapPin, UserRound, Building2, CalendarClock, ShieldCheck, AlertTriangle, CheckCircle2, Download, RefreshCw, SlidersHorizontal, Target
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import useAsync from '../hooks/useAsync';
import {
  getBox, getStockTransactions, getInspections, removeExpiredStock, removeBoxItem, retireBox, generateBoxQr, downloadBoxQr
} from '../services/api';
import {
  PageHeader, Card, StatusBadge, ProgressBar, ScoreRing, Tabs, EmptyState, ErrorState, PageLoader, Pagination, Modal, Spinner, useConfirm
} from '../components/ui';
import KitFormModal from '../components/kits/KitFormModal';
import { StockActionModal, AddItemModal } from '../components/kits/StockModals';
import { formatDate, formatDateTime, daysLabel, labelize, errorMessage, saveBlob } from '../utils/format';
import './Kits.css';

const ItemMenu = ({ onAction, canManage, hasExpired }) => {
  const [open, setOpen] = useState(false);
  if (!canManage) return null;
  return (
    <div className="dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button className="btn btn-ghost btn-xs btn-icon" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} aria-label="More actions"><MoreHorizontal size={16} /></button>
      {open && (
        <div className="dropdown-menu" style={{ minWidth: 200 }}>
          <button className="dropdown-item" onClick={() => { setOpen(false); onAction('adjust'); }}><SlidersHorizontal size={15} /> Correct quantity</button>
          <button className="dropdown-item" onClick={() => { setOpen(false); onAction('require'); }}><Target size={15} /> Change required qty</button>
          {hasExpired && <button className="dropdown-item" onClick={() => { setOpen(false); onAction('remove-expired'); }}><CalendarX2 size={15} /> Remove expired batches</button>}
          <div className="dropdown-divider" />
          <button className="dropdown-item danger" onClick={() => { setOpen(false); onAction('remove'); }}><Trash2 size={15} /> Remove from kit</button>
        </div>
      )}
    </div>
  );
};

const ContentsTab = ({ kit, canManage, onChanged }) => {
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(() => new Set());
  const [action, setAction] = useState(null); // { mode, item }
  const [adding, setAdding] = useState(false);

  const toggle = (id) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const handle = async (mode, item) => {
    if (['restock', 'dispense', 'adjust', 'require'].includes(mode)) return setAction({ mode, item });
    try {
      if (mode === 'remove-expired') {
        const ok = await confirm({ title: `Remove expired ${item.item.name}?`, message: 'Expired batches are removed from the kit and recorded as written off.', confirmLabel: 'Remove expired', tone: 'danger' });
        if (!ok) return undefined;
        const res = await removeExpiredStock(kit._id, item.item._id);
        toast.success(res.data.message); onChanged(res.data.data);
      }
      if (mode === 'remove') {
        const ok = await confirm({
          title: `Remove ${item.item.name} from ${kit.boxId}?`,
          message: item.currentQty > 0 ? `The ${item.currentQty} unit(s) still recorded will be written off. This is logged in the stock history.` : 'It will no longer be part of this kit’s required contents.',
          confirmLabel: 'Remove item', tone: 'danger'
        });
        if (!ok) return undefined;
        const res = await removeBoxItem(kit._id, item.item._id);
        toast.success(res.data.message); onChanged(res.data.data);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
    return undefined;
  };

  return (
    <div className="card card-flush">
      <div className="card-header">
        <div><h3 className="card-title">Contents</h3><p className="card-subtitle">{kit.items.length} items · quantities are the sum of all batches</p></div>
        {canManage && <button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}><Plus size={15} /> Add item</button>}
      </div>
      {kit.items.length === 0 ? <EmptyState title="This kit has no items" description="Add the supplies this kit must contain." /> : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th style={{ width: 32 }} /><th>Item</th><th>Stock</th><th>Nearest expiry</th><th>Status</th><th className="actions">Actions</th></tr></thead>
            <tbody>
              {kit.items.map((i) => {
                const id = i.item._id;
                const pct = i.requiredQty ? Math.round((i.currentQty / i.requiredQty) * 100) : 100;
                const hasExpired = (i.stocks || []).some((s) => s.status === 'expired');
                const isOpen = expanded.has(id);
                return (
                  <Fragment key={id}>
                    <tr className="clickable" onClick={() => toggle(id)}>
                      <td>{isOpen ? <ChevronDown size={16} className="muted" /> : <ChevronRight size={16} className="muted" />}</td>
                      <td>
                        <div className="cell-primary">{i.item.name}</div>
                        <div className="cell-sub">{labelize(i.item.category)}{i.item.isMandatory ? ' · Mandatory' : ''} · {(i.stocks || []).length} batch{(i.stocks || []).length === 1 ? '' : 'es'}</div>
                      </td>
                      <td>
                        <div className="qty-cell">
                          <span className="nowrap"><strong className="strong">{i.currentQty}</strong> <span className="muted">/ {i.requiredQty} {i.item.unit}</span></span>
                          <ProgressBar value={pct} />
                        </div>
                      </td>
                      <td>{i.nearestExpiry ? <StatusBadge value={i.expiryStatus} label={i.expiryStatus === 'expired' ? 'Expired' : `${formatDate(i.nearestExpiry)}`} /> : <span className="faint small">No expiry</span>}</td>
                      <td><StatusBadge value={i.stockStatus} /></td>
                      <td className="actions" onClick={(e) => e.stopPropagation()}>
                        {canManage && (
                          <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                            <button className="btn btn-secondary btn-xs" onClick={() => handle('restock', i)} title="Add stock"><PackagePlus size={14} /> Restock</button>
                            <button className="btn btn-ghost btn-xs" onClick={() => handle('dispense', i)} disabled={!i.currentQty} title="Record usage"><Minus size={14} /> Use</button>
                            <ItemMenu canManage={canManage} hasExpired={hasExpired} onAction={(m) => handle(m, i)} />
                          </div>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="item-row-expand">
                        <td colSpan={6}>
                          {(i.stocks || []).length === 0 ? <p className="small muted" style={{ padding: '12px 56px' }}>No stock recorded.</p> : (
                            <table className="batch-table">
                              <thead><tr><th>Batch</th><th>Quantity</th><th>Expiry</th><th>Supplier</th><th>Added</th></tr></thead>
                              <tbody>
                                {i.stocks.map((s) => (
                                  <tr key={s._id}>
                                    <td className="mono">{s.batchNumber || '—'}</td>
                                    <td>{s.quantity} {i.item.unit}</td>
                                    <td>{s.expiryDate ? <StatusBadge value={s.status} label={`${formatDate(s.expiryDate)} (${daysLabel(s.daysRemaining)})`} /> : <span className="faint">None</span>}</td>
                                    <td>{s.supplier || '—'}</td>
                                    <td>{formatDate(s.addedAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <StockActionModal open={Boolean(action)} mode={action?.mode} item={action?.item} kit={kit} onClose={() => setAction(null)} onDone={onChanged} />
      <AddItemModal open={adding} kit={kit} onClose={() => setAdding(false)} onDone={onChanged} />
    </div>
  );
};

const HistoryTab = ({ kitId }) => {
  const [page, setPage] = useState(1);
  const tx = useAsync(() => getStockTransactions({ box: kitId, page, limit: 15 }), [kitId, page]);
  if (tx.loading && !tx.data) return <div className="card"><PageLoader /></div>;
  if (tx.error) return <div className="card"><ErrorState error={tx.error} onRetry={tx.reload} /></div>;
  const rows = tx.data.data;
  return (
    <div className="card card-flush">
      {rows.length === 0 ? <EmptyState title="No stock movements yet" /> : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>When</th><th>Item</th><th>Movement</th><th className="num">Change</th><th className="num">Balance</th><th>By</th><th>Reason</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t._id}>
                  <td className="nowrap">{formatDateTime(t.createdAt)}</td>
                  <td className="cell-primary">{t.itemName}</td>
                  <td><StatusBadge value={t.type} /></td>
                  <td className={`num strong ${t.quantityChange > 0 ? 'text-green' : t.quantityChange < 0 ? 'text-red' : ''}`}>{t.quantityChange > 0 ? '+' : ''}{t.quantityChange}</td>
                  <td className="num">{t.quantityBefore} → {t.quantityAfter}</td>
                  <td>{t.performedByName || 'System'}</td>
                  <td className="small muted">{t.reason || '—'}{t.shortfall ? ` (short by ${t.shortfall})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={tx.data.currentPage} pages={tx.data.pages} total={tx.data.total} limit={15} onChange={setPage} />
    </div>
  );
};

const InspectionsTab = ({ kitId }) => {
  const list = useAsync(() => getInspections({ firstAidBox: kitId, limit: 20 }), [kitId]);
  if (list.loading) return <div className="card"><PageLoader /></div>;
  if (list.error) return <div className="card"><ErrorState error={list.error} onRetry={list.reload} /></div>;
  const rows = list.data.data;
  return (
    <div className="card card-flush">
      {rows.length === 0 ? <EmptyState icon={SearchCheck} title="Not inspected yet" description="Record the first inspection to start the schedule." /> : (
        <div className="list">
          {rows.map((r) => (
            <Link key={r._id} to={`/inspections/${r._id}`} className="list-item">
              <span className={`list-icon tone-${r.status === 'adequate' ? 'green' : r.status === 'failed' ? 'red' : 'amber'}`}><SearchCheck size={16} /></span>
              <div className="list-item-main">
                <div className="list-item-title">{r.inspectionId} · {labelize(r.status)}</div>
                <div className="list-item-sub">{formatDateTime(r.inspectionDate)} · {r.inspector?.name || r.inspectorName}{r.deficiencies?.length ? ` · ${r.deficiencies.length} deficiency(ies)` : ''}</div>
              </div>
              {r.complianceScore !== undefined && <StatusBadge value={r.complianceStatus} label={`${r.complianceScore}%`} />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const QrModal = ({ open, kit, onClose, canManage }) => {
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    try { const res = await generateBoxQr(kit._id); setQr(res.data.data.qrCodeData); toast.success('QR code generated'); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  const download = async () => {
    try { const res = await downloadBoxQr(kit._id); saveBlob(res.data, `QR-${kit.boxId}.png`); } catch (err) { toast.error(errorMessage(err, 'Download failed')); }
  };
  return (
    <Modal open={open} onClose={onClose} size="sm" title={`QR label for ${kit.boxId}`} description="Stick the label on the kit. Scanning it opens this kit’s profile."
      footer={<><button className="btn btn-secondary" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={download}><Download size={15} /> Download PNG</button></>}>
      <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
        {qr ? <img src={qr} alt={`QR code for ${kit.boxId}`} className="qr-preview" /> : <div className="qr-preview" style={{ display: 'grid', placeItems: 'center' }}><QrCode size={48} className="faint" /></div>}
        {canManage && <button className="btn btn-ghost btn-sm" onClick={generate} disabled={busy}>{busy ? <Spinner size="sm" /> : <RefreshCw size={14} />} {kit.qrCodeId ? 'Regenerate code' : 'Generate code'}</button>}
        <p className="xsmall muted" style={{ textAlign: 'center' }}>Regenerating invalidates labels printed earlier.</p>
      </div>
    </Modal>
  );
};

const KitDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const confirm = useConfirm();
  const [tab, setTab] = useState('contents');
  const [editing, setEditing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const kit = useAsync(() => getBox(id), [id], { select: (r) => r.data.data });
  const canManage = can('manageInventory');

  if (kit.loading && !kit.data) return <PageLoader />;
  if (kit.error) return <div className="page-content"><div className="card"><ErrorState error={kit.error} onRetry={kit.reload} /></div></div>;
  const k = kit.data;
  const expiredUnits = k.health?.expiredUnits || 0;
  const certified = k.inCharge?.firstAidCertified && (!k.inCharge.certificationExpiry || new Date(k.inCharge.certificationExpiry) > new Date());

  const removeAllExpired = async () => {
    const ok = await confirm({ title: 'Remove all expired stock?', message: `${expiredUnits} expired unit(s) will be removed from ${k.boxId} and recorded as written off.`, confirmLabel: 'Remove expired', tone: 'danger' });
    if (!ok) return;
    try { const res = await removeExpiredStock(k._id); toast.success(res.data.message); kit.setData(res.data.data); } catch (err) { toast.error(errorMessage(err)); }
  };
  const retire = async () => {
    const ok = await confirm({ title: `Retire kit ${k.boxId}?`, message: 'The kit is removed from active lists and compliance. Its history is kept.', confirmLabel: 'Retire kit', tone: 'danger' });
    if (!ok) return;
    try { const res = await retireBox(k._id, 'Retired from kit page'); toast.success(res.data.message); navigate('/kits'); } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="page-content">
      <PageHeader
        back={{ to: '/kits', label: 'All kits' }}
        title={<span className="row wrap" style={{ gap: 12 }}>{k.boxId} <StatusBadge value={k.status} size="lg" /></span>}
        subtitle={`Class ${k.classType} first aid kit · ${k.department?.name || ''}`}
        actions={(
          <>
            {expiredUnits > 0 && canManage && <button className="btn btn-danger-soft" onClick={removeAllExpired}><CalendarX2 size={16} /> Remove expired ({expiredUnits})</button>}
            <button className="btn btn-secondary" onClick={() => setShowQr(true)}><QrCode size={16} /> QR label</button>
            {canManage && <button className="btn btn-secondary" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button>}
            {can('inspect') && <Link to={`/kits/${k._id}/inspect`} className="btn btn-primary"><SearchCheck size={16} /> Inspect</Link>}
            {can('retireKits') && <button className="btn btn-ghost btn-icon" onClick={retire} title="Retire kit" aria-label="Retire kit"><Trash2 size={16} /></button>}
          </>
        )}
      />

      <div className="card mb-24">
        <div className="kit-hero">
          <div>
            <div className="detail-list">
              <div className="detail-row"><span className="detail-label"><MapPin size={12} /> Location</span><span className="detail-value">{k.location}{k.floor ? ` · ${k.floor}` : ''}</span></div>
              <div className="detail-row"><span className="detail-label"><Building2 size={12} /> Department</span><span className="detail-value">{k.department?.name}</span></div>
              <div className="detail-row"><span className="detail-label"><UserRound size={12} /> In charge</span>
                <span className="detail-value">{k.inCharge ? <>{k.inCharge.name} {certified ? <span className="badge badge-green">Certified</span> : <span className="badge badge-amber">Not certified</span>}</> : <span className="text-amber">Unassigned</span>}</span>
              </div>
              <div className="detail-row"><span className="detail-label"><CalendarClock size={12} /> Next inspection</span>
                <span className={`detail-value ${k.nextInspectionDue && new Date(k.nextInspectionDue) < new Date() ? 'text-red' : ''}`}>{k.nextInspectionDue ? `${formatDate(k.nextInspectionDue)} (${daysLabel(Math.ceil((new Date(k.nextInspectionDue) - Date.now()) / 86400000))})` : 'Not scheduled'}</span>
              </div>
            </div>
            <div className="kit-hero-stats">
              <div className="mini-stat"><div className="label">Items</div><div className="value">{k.items.length}</div></div>
              <div className="mini-stat"><div className="label">Units in kit</div><div className="value">{k.health?.totalUnits ?? 0}</div></div>
              <div className="mini-stat"><div className="label">Below required</div><div className={`value ${k.health?.lowStockItems ? 'text-amber' : ''}`}>{k.health?.lowStockItems ?? 0}</div></div>
              <div className="mini-stat"><div className="label">Expired units</div><div className={`value ${expiredUnits ? 'text-red' : ''}`}>{expiredUnits}</div></div>
            </div>
          </div>
          <div style={{ display: 'grid', placeItems: 'center', gap: 6 }}>
            <ScoreRing score={k.compliance.score} label="compliance" />
            <StatusBadge value={k.compliance.status} />
          </div>
        </div>
        {k.compliance.issues.length > 0 ? (
          <div className="stack-sm" style={{ marginTop: 18 }}>
            {k.compliance.issues.map((iss) => (
              <div key={iss.message} className={`alert ${iss.severity === 'critical' ? 'alert-danger' : 'alert-warning'}`} style={{ padding: '8px 12px' }}>
                <AlertTriangle size={16} /><span>{iss.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="alert alert-success" style={{ marginTop: 18, padding: '8px 12px' }}><CheckCircle2 size={16} /> This kit meets every compliance rule.</div>
        )}
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'contents', label: 'Contents', icon: ShieldCheck, count: k.items.length },
        { value: 'history', label: 'Stock history', icon: RefreshCw },
        { value: 'inspections', label: 'Inspections', icon: SearchCheck }
      ]} />
      {tab === 'contents' && <ContentsTab kit={k} canManage={canManage} onChanged={(data) => kit.setData(data)} />}
      {tab === 'history' && <HistoryTab kitId={k._id} />}
      {tab === 'inspections' && <InspectionsTab kitId={k._id} />}

      <KitFormModal open={editing} kit={k} onClose={() => setEditing(false)} onSaved={() => kit.refresh()} />
      <QrModal open={showQr} kit={k} onClose={() => setShowQr(false)} canManage={canManage} />
    </div>
  );
};

export default KitDetail;
