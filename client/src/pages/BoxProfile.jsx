import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { scanBoxQr } from '../services/api';
import { Package, MapPin, AlertTriangle, CheckCircle, Clock, Info, ArrowLeft, User, FileText, Activity } from 'lucide-react';
import './BoxProfile.css';

const BoxProfile = () => {
  const { boxId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    scanBoxQr(boxId)
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.message || 'Box not found'))
      .finally(() => setLoading(false));
  }, [boxId]);

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;
  if (error) return <div className="empty-state"><AlertTriangle size={48} /><p>{error}</p></div>;
  if (!data) return null;

  const { box, summary, expiryStatus, complianceStatus, lastInspection } = data;

  const complianceIcon = (status) => {
    if (status === 'compliant') return <CheckCircle size={24} className="text-green" />;
    if (status === 'warning') return <AlertTriangle size={24} className="text-amber" />;
    return <AlertTriangle size={24} className="text-red" />;
  };

  const getComplianceColor = (status) => {
    if (status === 'compliant') return 'green';
    if (status === 'warning') return 'amber';
    return 'red';
  };

  return (
    <div className="page-content box-profile">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">{box.boxId}</h1>
            <p className="page-subtitle">First Aid Box Profile</p>
          </div>
        </div>
        <div className={`compliance-badge ${getComplianceColor(complianceStatus)}`}>
          {complianceIcon(complianceStatus)}
          <span>{complianceStatus.toUpperCase()}</span>
        </div>
      </div>

      <div className="box-profile-grid">
        <div className="box-left-col">
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}><Info size={18} /> Box Information</h3>
            <div className="detail-row"><span className="detail-label">Location</span><span className="detail-value">{box.location}</span></div>
            <div className="detail-row"><span className="detail-label">Department</span><span className="detail-value">{box.department?.name || '—'}</span></div>
            <div className="detail-row"><span className="detail-label">Risk Category</span><span className="detail-value"><span className={`badge badge-${box.riskCategory === 'high' ? 'red' : 'blue'}`}>{box.riskCategory}</span></span></div>
            <div className="detail-row"><span className="detail-label">Class</span><span className="detail-value">{box.classType}</span></div>
            <div className="detail-row"><span className="detail-label">In-Charge</span><span className="detail-value">{box.inCharge?.name || '—'}</span></div>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 16 }}><Activity size={18} /> Status Overview</h3>
            <div className="grid-stats mini">
              <div className="stat-card blue">
                <div><div className="stat-value">{summary.totalItems}</div><div className="stat-label">Total Items</div></div>
              </div>
              <div className={`stat-card ${summary.lowStockItems > 0 ? 'amber' : 'green'}`}>
                <div><div className="stat-value">{summary.lowStockItems}</div><div className="stat-label">Low Stock</div></div>
              </div>
              <div className={`stat-card ${summary.expiringItems > 0 ? 'amber' : 'green'}`}>
                <div><div className="stat-value">{summary.expiringItems}</div><div className="stat-label">Expiring Soon</div></div>
              </div>
              <div className={`stat-card ${summary.expiredItems > 0 ? 'red' : 'green'}`}>
                <div><div className="stat-value">{summary.expiredItems}</div><div className="stat-label">Expired Items</div></div>
              </div>
            </div>
            
            <div style={{ marginTop: 24 }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Inspection Status</h4>
              {lastInspection ? (
                <div className="detail-row" style={{ borderBottom: 'none' }}>
                  <span className="detail-label">Last Checked</span>
                  <span className="detail-value">{new Date(lastInspection.date).toLocaleDateString()} by {lastInspection.inspectedBy?.name}</span>
                </div>
              ) : <p style={{ color: 'var(--text-muted)' }}>No inspections recorded yet.</p>}
              <div className="action-buttons" style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                <button className="btn btn-primary" onClick={() => navigate(`/inventory/boxes/${box._id}/inspect`)}>Run Inspection</button>
                <button className="btn btn-ghost" onClick={() => navigate('/treatments/new')}>Log Treatment</button>
              </div>
            </div>
          </div>
        </div>

        <div className="box-right-col">
          <div className="card h-100">
            <h3 className="card-title" style={{ marginBottom: 16 }}><Package size={18} /> Inventory Details</h3>
            {box.items?.length > 0 ? (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead><tr><th>Item</th><th>Qty</th><th>Req</th><th>Status</th><th>Expiry</th></tr></thead>
                  <tbody>
                    {box.items.map((item, i) => {
                      const qtyRatio = item.requiredQty > 0 ? item.currentQty / item.requiredQty : 1;
                      const qtyColor = qtyRatio >= 1 ? 'green' : qtyRatio >= 0.5 ? 'amber' : 'red';
                      
                      let expStatus = 'OK';
                      let expColor = 'green';
                      if (item.expiryDate) {
                        const daysLeft = Math.ceil((new Date(item.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                        if (daysLeft < 0) { expStatus = 'Expired'; expColor = 'red'; }
                        else if (daysLeft <= 30) { expStatus = `${daysLeft}d left`; expColor = 'red'; }
                        else if (daysLeft <= 90) { expStatus = `${daysLeft}d left`; expColor = 'amber'; }
                      }

                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.item?.name}</td>
                          <td style={{ color: `var(--${qtyColor === 'amber' ? 'orange-500' : qtyColor === 'red' ? 'red-600' : 'green-500'})`, fontWeight: 600 }}>{item.currentQty}</td>
                          <td>{item.requiredQty}</td>
                          <td><span className={`badge badge-${qtyColor}`}>{qtyColor === 'green' ? 'OK' : 'Low'}</span></td>
                          <td>{item.expiryDate ? <span className={`badge badge-${expColor}`}>{expStatus}</span> : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No items in this box.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoxProfile;
