import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExpiryDashboard, checkExpiryAlerts } from '../services/api';
import { Clock, AlertTriangle, AlertOctagon, CheckCircle, RefreshCw, ChevronDown, ChevronRight, Package, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import './ExpiryDashboard.css';

const ExpiryDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [expandedItems, setExpandedItems] = useState({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await getExpiryDashboard();
      setData(res.data.data);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleCheckAlerts = async () => {
    try {
      setChecking(true);
      const res = await checkExpiryAlerts();
      toast.success(res.data.message);
    } catch (e) { toast.error('Failed to check expiry alerts'); }
    finally { setChecking(false); }
  };

  const toggleExpand = (key) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;
  if (!data) return <div className="empty-state"><Clock size={48} /><p>No expiry data available</p></div>;

  const { summary, items } = data;
  const allExpiring = [...(items.expired || []), ...(items.critical7 || []), ...(items.critical30 || []), ...(items.warning90 || [])];

  const getItems = () => {
    switch (activeCategory) {
      case 'expired': return items.expired || [];
      case 'critical7': return items.critical7 || [];
      case 'critical30': return items.critical30 || [];
      case 'warning90': return items.warning90 || [];
      default: return allExpiring;
    }
  };

  const displayItems = getItems();

  // Group items by itemName + boxId for stock-level view
  const groupedItems = {};
  displayItems.forEach((item, idx) => {
    const key = `${item.boxId}-${item.itemName}`;
    if (!groupedItems[key]) {
      groupedItems[key] = {
        itemName: item.itemName,
        boxObjId: item.boxObjId,
        boxId: item.boxId,
        boxLocation: item.boxLocation,
        department: item.department,
        stocks: []
      };
    }
    groupedItems[key].stocks.push({ ...item, _idx: idx });
  });
  const groupedList = Object.entries(groupedItems);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expiry Tracking</h1>
          <p className="page-subtitle">Monitor expiry dates across all first aid inventory</p>
        </div>
        <button className="btn btn-primary" onClick={handleCheckAlerts} disabled={checking}>
          <RefreshCw size={18} className={checking ? 'spinning' : ''} />{checking ? 'Checking...' : 'Generate Alerts'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid-stats" style={{ marginBottom: 24 }}>
        <div className="stat-card red" onClick={() => setActiveCategory('expired')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon red"><AlertOctagon size={24} /></div>
          <div><div className="stat-value">{summary.expiredCount}</div><div className="stat-label">Expired Items</div></div>
        </div>
        <div className="stat-card red" onClick={() => setActiveCategory('critical7')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon red"><AlertTriangle size={24} /></div>
          <div><div className="stat-value">{summary.critical7Count}</div><div className="stat-label">Expiring in 7 Days</div></div>
        </div>
        <div className="stat-card amber" onClick={() => setActiveCategory('critical30')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon amber"><Clock size={24} /></div>
          <div><div className="stat-value">{summary.critical30Count}</div><div className="stat-label">Expiring in 30 Days</div></div>
        </div>
        <div className="stat-card blue" onClick={() => setActiveCategory('warning90')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon blue"><Clock size={24} /></div>
          <div><div className="stat-value">{summary.warning90Count}</div><div className="stat-label">Expiring in 90 Days</div></div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="expiry-tabs" style={{ marginBottom: 16 }}>
        {[
          { key: 'all', label: `All (${allExpiring.length})` },
          { key: 'expired', label: `Expired (${summary.expiredCount})` },
          { key: 'critical7', label: `7 Days (${summary.critical7Count})` },
          { key: 'critical30', label: `30 Days (${summary.critical30Count})` },
          { key: 'warning90', label: `90 Days (${summary.warning90Count})` }
        ].map(tab => (
          <button key={tab.key} className={`expiry-tab ${activeCategory === tab.key ? 'active' : ''}`} onClick={() => setActiveCategory(tab.key)}>{tab.label}</button>
        ))}
      </div>

      {/* Items Table — with expandable stock batches */}
      {groupedList.length > 0 ? (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr><th></th><th>Item</th><th>Box</th><th>Location</th><th>Department</th><th>Stocks</th><th>Nearest Expiry</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {groupedList.map(([key, group]) => {
                const isExpanded = expandedItems[key];
                const hasMultiStocks = group.stocks.length > 1;
                
                // Find nearest expiry across all stocks
                const nearestStock = group.stocks.reduce((nearest, s) => {
                  if (!s.expiryDate) return nearest;
                  if (!nearest) return s;
                  return new Date(s.expiryDate) < new Date(nearest.expiryDate) ? s : nearest;
                }, null);

                const nearestExp = nearestStock?.expiryDate ? new Date(nearestStock.expiryDate) : null;
                const isExpired = nearestExp && nearestExp < new Date();
                const daysLeft = nearestExp ? Math.ceil((nearestExp - new Date()) / (24 * 60 * 60 * 1000)) : null;
                const totalQty = group.stocks.reduce((sum, s) => sum + (s.currentQty || 0), 0);

                return (
                  <>
                    <tr key={key} onClick={() => hasMultiStocks && toggleExpand(key)} style={{ cursor: hasMultiStocks ? 'pointer' : 'default' }}>
                      <td style={{ width: 30 }}>
                        {hasMultiStocks ? (
                          isExpanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />
                        ) : <Package size={14} color="var(--text-muted)" />}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{group.itemName}</td>
                      <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{group.boxId}</td>
                      <td>{group.boxLocation}</td>
                      <td>{group.department}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{totalQty}</span>
                        {hasMultiStocks && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                            ({group.stocks.length} batches)
                          </span>
                        )}
                      </td>
                      <td>{nearestExp ? nearestExp.toLocaleDateString() : '—'}</td>
                      <td>
                        {isExpired ? <span className="badge badge-red">Expired</span> :
                         daysLeft <= 7 ? <span className="badge badge-red">{daysLeft}d left</span> :
                         daysLeft <= 30 ? <span className="badge badge-amber">{daysLeft}d left</span> :
                         <span className="badge badge-blue">{daysLeft}d left</span>}
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-ghost"
                          onClick={(e) => { e.stopPropagation(); navigate(`/inventory/boxes/scan/${group.boxId}`); }}
                          title="Edit Box Stocks"
                        >
                          <Edit2 size={16} /> Manage
                        </button>
                      </td>
                    </tr>
                    {/* Expanded stock rows */}
                    {isExpanded && group.stocks.map((stock, si) => {
                      const stockExp = stock.expiryDate ? new Date(stock.expiryDate) : null;
                      const stockExpired = stockExp && stockExp < new Date();
                      const stockDays = stockExp ? Math.ceil((stockExp - new Date()) / (24 * 60 * 60 * 1000)) : null;
                      return (
                        <tr key={`${key}-stock-${si}`} style={{ background: 'var(--bg-hover)', fontSize: '0.85rem' }}>
                          <td></td>
                          <td style={{ paddingLeft: 24, color: 'var(--text-secondary)' }}>
                            └ Batch: {stock.batchNumber || 'N/A'}
                          </td>
                          <td colSpan={2} style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {stock.supplier ? `Supplier: ${stock.supplier}` : ''}
                          </td>
                          <td></td>
                          <td style={{ fontWeight: 500 }}>{stock.currentQty || 0}</td>
                          <td>{stockExp ? stockExp.toLocaleDateString() : '—'}</td>
                           <td>
                            {stockExpired ? <span className="badge badge-red">Expired</span> :
                             stockDays <= 7 ? <span className="badge badge-red">{stockDays}d</span> :
                             stockDays <= 30 ? <span className="badge badge-amber">{stockDays}d</span> :
                             <span className="badge badge-blue">{stockDays}d</span>}
                          </td>
                          <td></td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state"><CheckCircle size={48} /><p>No items in this category</p></div>
      )}
    </div>
  );
};

export default ExpiryDashboard;
