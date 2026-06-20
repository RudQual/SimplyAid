import { useState, useEffect } from 'react';
import { getExpiryDashboard, checkExpiryAlerts } from '../services/api';
import { Clock, AlertTriangle, AlertOctagon, CheckCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import './ExpiryDashboard.css';

const ExpiryDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

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

      {/* Items Table */}
      {displayItems.length > 0 ? (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr><th>Item</th><th>Box</th><th>Location</th><th>Department</th><th>Qty</th><th>Expiry Date</th><th>Batch</th><th>Status</th></tr>
            </thead>
            <tbody>
              {displayItems.map((item, i) => {
                const exp = item.expiryDate ? new Date(item.expiryDate) : null;
                const isExpired = exp && exp < new Date();
                const daysLeft = exp ? Math.ceil((exp - new Date()) / (24 * 60 * 60 * 1000)) : null;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.itemName}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.boxId}</td>
                    <td>{item.boxLocation}</td>
                    <td>{item.department}</td>
                    <td>{item.currentQty}</td>
                    <td>{exp ? exp.toLocaleDateString() : '—'}</td>
                    <td>{item.batchNumber || '—'}</td>
                    <td>
                      {isExpired ? <span className="badge badge-red">Expired</span> :
                       daysLeft <= 7 ? <span className="badge badge-red">{daysLeft}d left</span> :
                       daysLeft <= 30 ? <span className="badge badge-amber">{daysLeft}d left</span> :
                       <span className="badge badge-blue">{daysLeft}d left</span>}
                    </td>
                  </tr>
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
