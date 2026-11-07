import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Package, PackageX, CalendarX2, Layers, ArrowUpDown, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import useAsync from '../hooks/useAsync';
import { getInventoryItems, getInventorySummary, exportReport } from '../services/api';
import { PageHeader, SearchInput, StatusBadge, StatCard, EmptyState, ErrorState, SkeletonRows, Pagination, ProgressBar } from '../components/ui';
import ItemFormModal from '../components/inventory/ItemFormModal';
import { CATEGORIES, labelize, formatDate, formatNumber, daysLabel, errorMessage, saveBlob } from '../utils/format';

const LIMIT = 15;
const SORTS = [['name', 'Name (A–Z)'], ['status', 'Stock status'], ['fillRate', 'Fill rate (lowest)'], ['expiry', 'Nearest expiry'], ['-quantity', 'Quantity (highest)'], ['category', 'Category']];

const Inventory = () => {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const f = {
    search: params.get('search') || '',
    category: params.get('category') || '',
    stockStatus: params.get('stockStatus') || '',
    expiryStatus: params.get('expiryStatus') || '',
    sort: params.get('sort') || 'name',
    page: Number(params.get('page')) || 1
  };
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const summary = useAsync(() => getInventorySummary(), [], { select: (r) => r.data.data.totals });
  const items = useAsync(() => getInventoryItems({
    search: f.search || undefined, category: f.category || undefined, stockStatus: f.stockStatus || undefined,
    expiryStatus: f.expiryStatus || undefined, sort: f.sort, page: f.page, limit: LIMIT
  }), [params.toString()]);

  const exportCsv = async () => {
    try {
      const res = await exportReport('inventory', 'csv', { category: f.category || undefined, stockStatus: f.stockStatus || undefined });
      saveBlob(res.data, `inventory-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) { toast.error(errorMessage(err, 'Export failed')); }
  };

  const t = summary.data;
  const rows = items.data?.data || [];

  return (
    <div className="page-content">
      <PageHeader
        title="Inventory"
        subtitle="Every supply in the catalog with stock aggregated across all kits."
        actions={(
          <>
            <button className="btn btn-secondary" onClick={exportCsv}><Download size={15} /> Export CSV</button>
            {can('manageCatalog') && <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New item</button>}
          </>
        )}
      />

      <div className="stat-grid">
        <StatCard label="Catalog items" value={formatNumber(t?.catalogItems)} icon={Layers} tone="blue" loading={summary.loading} onClick={() => setParams({})} meta={`${formatNumber(t?.totalUnits)} units in kits`} />
        <StatCard label="Low stock" value={formatNumber(t?.lowStockItems)} icon={Package} tone="amber" loading={summary.loading} onClick={() => setFilter('stockStatus', 'low_stock')} meta={`${t?.lowStockSlots ?? 0} kit slots below required`} />
        <StatCard label="Out of stock" value={formatNumber(t?.outOfStockItems)} icon={PackageX} tone="red" loading={summary.loading} onClick={() => setFilter('stockStatus', 'out_of_stock')} meta={`${t?.notStockedItems ?? 0} not assigned to any kit`} />
        <StatCard label="Expired units" value={formatNumber(t?.expiredUnits)} icon={CalendarX2} tone="violet" loading={summary.loading} onClick={() => setFilter('expiryStatus', 'expired')} meta={`${formatNumber(t?.expiringSoonUnits)} expiring within 30 days`} />
      </div>

      <div className="card card-flush">
        <div className="toolbar">
          <SearchInput value={f.search} onChange={(v) => setFilter('search', v)} placeholder="Search items…" />
          <select value={f.category} onChange={(e) => setFilter('category', e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{labelize(c)}</option>)}
          </select>
          <select value={f.stockStatus} onChange={(e) => setFilter('stockStatus', e.target.value)} aria-label="Stock status">
            <option value="">Any stock status</option>
            {['in_stock', 'low_stock', 'out_of_stock', 'not_stocked'].map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
          </select>
          <select value={f.expiryStatus} onChange={(e) => setFilter('expiryStatus', e.target.value)} aria-label="Expiry status">
            <option value="">Any expiry</option>
            <option value="expired">Has expired stock</option>
            <option value="expiring">Expiring ≤ 30 days</option>
            <option value="ok">All in date</option>
          </select>
          <div className="toolbar-spacer" />
          <div className="row"><ArrowUpDown size={15} className="muted" />
            <select value={f.sort} onChange={(e) => setFilter('sort', e.target.value)} aria-label="Sort">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
        </div>

        {items.loading && !items.data && <SkeletonRows rows={8} cols={5} />}
        {items.error && <ErrorState error={items.error} onRetry={items.reload} />}
        {items.data && rows.length === 0 && (
          <EmptyState icon={Package} title="No items found" description="Adjust the filters or add a new catalog item."
            action={can('manageCatalog') && <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New item</button>} />
        )}
        {rows.length > 0 && (
          <div className="table-container" style={{ opacity: items.loading ? 0.6 : 1, transition: 'opacity .15s' }}>
            <table className="data-table">
              <thead>
                <tr><th>Item</th><th>Category</th><th className="num">In stock</th><th style={{ minWidth: 150 }}>Fill rate</th><th className="num hide-sm">Kits</th><th>Status</th><th className="hide-sm">Nearest expiry</th></tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i._id} className="clickable" onClick={() => navigate(`/inventory/${i._id}`)}>
                    <td>
                      <div className="cell-primary">{i.name}</div>
                      <div className="cell-sub">{i.unit}{i.isMandatory ? ' · Mandatory' : ''}{i.isGlobal ? ' · Statutory' : ''}</div>
                    </td>
                    <td>{labelize(i.category)}</td>
                    <td className="num"><strong className="strong">{formatNumber(i.stock.totalQty)}</strong> <span className="muted">/ {formatNumber(i.stock.totalRequired)}</span></td>
                    <td>{i.stock.fillRate === null ? <span className="faint small">—</span> : (
                      <div className="row"><div style={{ flex: 1 }}><ProgressBar value={i.stock.fillRate} /></div><span className="xsmall muted" style={{ width: 34, textAlign: 'right' }}>{i.stock.fillRate}%</span></div>
                    )}</td>
                    <td className="num hide-sm">{i.stock.boxCount}{i.stock.lowStockBoxes ? <span className="text-amber xsmall"> ({i.stock.lowStockBoxes} low)</span> : ''}</td>
                    <td><StatusBadge value={i.stock.stockStatus} /></td>
                    <td className="hide-sm">
                      {i.stock.expiredQty > 0 ? <StatusBadge value="expired" label={`${i.stock.expiredQty} expired`} />
                        : i.stock.nearestExpiry ? <span className={i.stock.daysToNearestExpiry <= 30 ? 'text-amber' : ''}>{formatDate(i.stock.nearestExpiry)} <span className="xsmall muted">({daysLabel(i.stock.daysToNearestExpiry)})</span></span>
                          : <span className="faint small">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {items.data && <Pagination page={items.data.currentPage} pages={items.data.pages} total={items.data.total} limit={LIMIT} onChange={(p) => setFilter('page', String(p))} />}
      </div>

      <ItemFormModal open={creating} onClose={() => setCreating(false)} onSaved={(item) => navigate(`/inventory/${item._id}`)} />
    </div>
  );
};

export default Inventory;
