import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeftRight, Download, X } from 'lucide-react';
import useAsync from '../hooks/useAsync';
import { getStockTransactions, exportReport } from '../services/api';
import { PageHeader, SearchInput, StatusBadge, EmptyState, ErrorState, SkeletonRows, Pagination } from '../components/ui';
import { formatDateTime, labelize, errorMessage, saveBlob } from '../utils/format';

const LIMIT = 25;
const TYPES = ['restock', 'dispense', 'adjustment', 'expired_removal', 'item_added', 'item_removed', 'kit_retired'];

const StockMovements = () => {
  const [params, setParams] = useSearchParams();
  const f = {
    search: params.get('search') || '', type: params.get('type') || '', startDate: params.get('startDate') || '',
    endDate: params.get('endDate') || '', item: params.get('item') || '', box: params.get('box') || '', page: Number(params.get('page')) || 1
  };
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const query = Object.fromEntries(Object.entries({ ...f, limit: LIMIT }).filter(([, v]) => v));
  const tx = useAsync(() => getStockTransactions(query), [params.toString()]);

  const exportCsv = async () => {
    try {
      const res = await exportReport('stock-movements', 'csv', { type: f.type || undefined, startDate: f.startDate || undefined, endDate: f.endDate || undefined });
      saveBlob(res.data, `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) { toast.error(errorMessage(err, 'Export failed')); }
  };

  const rows = tx.data?.data || [];
  return (
    <div className="page-content">
      <PageHeader title="Stock movements" subtitle="Append-only ledger of every restock, use, correction and write-off across all kits."
        actions={<button className="btn btn-secondary" onClick={exportCsv}><Download size={15} /> Export CSV</button>} />
      <div className="card card-flush">
        <div className="toolbar">
          <SearchInput value={f.search} onChange={(v) => setFilter('search', v)} placeholder="Search item, kit, person, reason…" />
          <select value={f.type} onChange={(e) => setFilter('type', e.target.value)} aria-label="Movement type">
            <option value="">All movements</option>{TYPES.map((t) => <option key={t} value={t}>{labelize(t)}</option>)}
          </select>
          <input type="date" value={f.startDate} onChange={(e) => setFilter('startDate', e.target.value)} style={{ width: 'auto' }} aria-label="From date" />
          <input type="date" value={f.endDate} onChange={(e) => setFilter('endDate', e.target.value)} style={{ width: 'auto' }} aria-label="To date" />
          {(f.item || f.box) && <button className="chip" onClick={() => { setFilter('item', ''); setFilter('box', ''); }}>Filtered to one {f.item ? 'item' : 'kit'} <X size={13} /></button>}
        </div>
        {tx.loading && !tx.data && <SkeletonRows rows={10} cols={6} />}
        {tx.error && <ErrorState error={tx.error} onRetry={tx.reload} />}
        {tx.data && rows.length === 0 && <EmptyState icon={ArrowLeftRight} title="No movements found" />}
        {rows.length > 0 && (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>When</th><th>Item</th><th>Kit</th><th>Type</th><th className="num">Change</th><th className="num hide-sm">Balance</th><th>By</th><th className="hide-sm">Reason / reference</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t._id}>
                    <td className="nowrap small">{formatDateTime(t.createdAt)}</td>
                    <td className="cell-primary"><Link to={`/inventory/${t.item}`}>{t.itemName}</Link></td>
                    <td><Link to={`/kits/${t.box}`}>{t.boxCode}</Link></td>
                    <td><StatusBadge value={t.type} /></td>
                    <td className={`num strong ${t.quantityChange > 0 ? 'text-green' : t.quantityChange < 0 ? 'text-red' : ''}`}>{t.quantityChange > 0 ? '+' : ''}{t.quantityChange}</td>
                    <td className="num hide-sm">{t.quantityBefore} → {t.quantityAfter}</td>
                    <td>{t.performedByName || 'System'}</td>
                    <td className="small muted hide-sm">
                      {t.reference?.id && t.reference.model === 'Incident' ? <Link to={`/incidents/${t.reference.id}`}>{t.reference.label}</Link> : t.reference?.label}
                      {t.reference?.label && t.reason ? ' · ' : ''}{t.reason}{t.shortfall ? ` (short by ${t.shortfall})` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tx.data && <Pagination page={tx.data.currentPage} pages={tx.data.pages} total={tx.data.total} limit={LIMIT} onChange={(p) => setFilter('page', String(p))} />}
      </div>
    </div>
  );
};

export default StockMovements;
