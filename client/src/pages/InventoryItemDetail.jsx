import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Pencil, Archive, Boxes, ArrowLeftRight, Package } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import useAsync from '../hooks/useAsync';
import { getInventoryItem, deleteInventoryItem } from '../services/api';
import { PageHeader, Card, StatusBadge, ProgressBar, EmptyState, ErrorState, PageLoader, StatCard, useConfirm } from '../components/ui';
import ItemFormModal from '../components/inventory/ItemFormModal';
import { formatDate, formatDateTime, labelize, daysLabel, errorMessage, formatNumber } from '../utils/format';

const InventoryItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const item = useAsync(() => getInventoryItem(id), [id], { select: (r) => r.data.data });

  if (item.loading && !item.data) return <PageLoader />;
  if (item.error) return <div className="page-content"><div className="card"><ErrorState error={item.error} onRetry={item.reload} /></div></div>;
  const it = item.data;
  const s = it.stock || {};
  const editable = can('manageCatalog') && (!it.isGlobal || user.role === 'admin');

  const archive = async () => {
    const ok = await confirm({ title: `Archive ${it.name}?`, message: 'The item is hidden from the catalog. Its stock history is kept. Items still used in kits cannot be archived.', confirmLabel: 'Archive', tone: 'danger' });
    if (!ok) return;
    try { const res = await deleteInventoryItem(it._id); toast.success(res.data.message); navigate('/inventory'); } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="page-content">
      <PageHeader
        back={{ to: '/inventory', label: 'Inventory' }}
        title={<span className="row wrap" style={{ gap: 12 }}>{it.name}{it.isActive === false ? <span className="badge badge-gray">Archived</span> : <StatusBadge value={s.stockStatus} size="lg" />}</span>}
        subtitle={`${labelize(it.category)} · measured in ${it.unit}${it.isMandatory ? ' · mandatory supply' : ''}`}
        actions={editable && it.isActive !== false && (
          <>
            <button className="btn btn-secondary" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button>
            {can('retireKits') && <button className="btn btn-ghost" onClick={archive}><Archive size={15} /> Archive</button>}
          </>
        )}
      />
      {it.isGlobal && user.role !== 'admin' && <div className="alert alert-info mb-16"><Package size={16} /> This is a statutory item shared by all companies. Only administrators can edit it.</div>}

      <div className="stat-grid">
        <StatCard label="Units in stock" value={formatNumber(s.totalQty)} icon={Package} tone="blue" meta={`${formatNumber(s.availableQty)} usable (not expired)`} />
        <StatCard label="Required across kits" value={formatNumber(s.totalRequired)} icon={Boxes} tone="teal" meta={s.fillRate !== null ? `${s.fillRate}% fill rate` : 'Not required anywhere'} />
        <StatCard label="Kits short" value={formatNumber(s.lowStockBoxes)} icon={Boxes} tone="amber" meta={`${s.outOfStockBoxes} with none at all`} />
        <StatCard label="Nearest expiry" value={s.nearestExpiry ? formatDate(s.nearestExpiry) : '—'} icon={ArrowLeftRight} tone={s.expiredQty ? 'red' : 'violet'} meta={s.expiredQty ? `${s.expiredQty} unit(s) already expired` : (s.nearestExpiry ? daysLabel(s.daysToNearestExpiry) : 'No dated stock')} />
      </div>

      <div className="grid-main-side">
        <Card title="Stock by kit" flush icon={Boxes} subtitle={`${it.kits.length} kit${it.kits.length === 1 ? '' : 's'} hold this item`}>
          {it.kits.length === 0 ? <EmptyState title="Not part of any kit" description="Add it to a kit from the kit’s Contents tab." /> : (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Kit</th><th>Stock</th><th>Batches</th><th>Status</th></tr></thead>
                <tbody>
                  {it.kits.map((k) => (
                    <tr key={k._id} className="clickable" onClick={() => navigate(`/kits/${k._id}`)}>
                      <td><div className="cell-primary">{k.boxId}</div><div className="cell-sub">{k.location} · {k.department}</div></td>
                      <td style={{ minWidth: 150 }}>
                        <div className="small"><strong>{k.currentQty}</strong> <span className="muted">/ {k.requiredQty}</span></div>
                        <ProgressBar value={k.requiredQty ? (k.currentQty / k.requiredQty) * 100 : 100} />
                      </td>
                      <td>
                        <div className="tag-list">
                          {k.batches.length === 0 && <span className="faint small">None</span>}
                          {k.batches.map((b) => <StatusBadge key={b._id} value={b.status === 'none' ? 'ok' : b.status} dot={false} label={`${b.quantity} · ${b.expiryDate ? formatDate(b.expiryDate) : 'no expiry'}`} />)}
                        </div>
                      </td>
                      <td><StatusBadge value={k.stockStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="stack">
          <Card title="Details">
            <div className="detail-list" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="detail-row"><span className="detail-label">Class A</span><span className="detail-value">{it.requiredQty?.classA ?? 0}</span></div>
              <div className="detail-row"><span className="detail-label">Class B</span><span className="detail-value">{it.requiredQty?.classB ?? 0}</span></div>
              <div className="detail-row"><span className="detail-label">Class C</span><span className="detail-value">{it.requiredQty?.classC ?? 0}</span></div>
              <div className="detail-row"><span className="detail-label">Shelf life</span><span className="detail-value">{it.defaultShelfLifeDays} days</span></div>
              <div className="detail-row full-width"><span className="detail-label">Description</span><span className="detail-value">{it.description || '—'}</span></div>
            </div>
          </Card>
          <Card title="Recent movements" flush icon={ArrowLeftRight} actions={<Link to={`/stock-movements?item=${it._id}`} className="card-link">All</Link>}>
            {it.transactions.length === 0 ? <EmptyState title="No movements yet" /> : (
              <div className="list">
                {it.transactions.slice(0, 8).map((t) => (
                  <div key={t._id} className="list-item">
                    <div className="list-item-main">
                      <div className="list-item-title">{labelize(t.type)} · {t.boxCode}</div>
                      <div className="list-item-sub">{formatDateTime(t.createdAt)} · {t.performedByName || 'System'}</div>
                    </div>
                    <strong className={t.quantityChange > 0 ? 'text-green' : t.quantityChange < 0 ? 'text-red' : ''}>{t.quantityChange > 0 ? '+' : ''}{t.quantityChange}</strong>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <ItemFormModal open={editing} item={it} onClose={() => setEditing(false)} onSaved={() => item.refresh()} />
    </div>
  );
};

export default InventoryItemDetail;
