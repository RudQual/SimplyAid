import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { scanBoxQr, updateBoxItemStocks } from '../services/api';
import { Package, MapPin, AlertTriangle, CheckCircle, Clock, Info, ArrowLeft, User, FileText, Activity, Edit2, Plus, Trash2, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import './BoxProfile.css';

const BoxProfile = () => {
  const { boxId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Stocks Modal State
  const [showStocksModal, setShowStocksModal] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [editStocks, setEditStocks] = useState([]);
  const [savingStocks, setSavingStocks] = useState(false);

  const loadData = () => {
    setLoading(true);
    scanBoxQr(boxId)
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.message || 'Box not found'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
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

  // ---- Stocks Management Handlers ----

  const openStocksModal = (item) => {
    setActiveItem(item);
    // Clone stocks to edit state
    setEditStocks(item.stocks?.length ? JSON.parse(JSON.stringify(item.stocks)) : []);
    setShowStocksModal(true);
  };

  const handleAddStock = () => {
    setEditStocks([
      ...editStocks, 
      { batchNumber: '', quantity: 1, expiryDate: '', supplier: '' }
    ]);
  };

  const handleRemoveStock = (index) => {
    setEditStocks(editStocks.filter((_, i) => i !== index));
  };

  const handleStockChange = (index, field, value) => {
    const updated = [...editStocks];
    updated[index][field] = value;
    setEditStocks(updated);
  };

  const handleSaveStocks = async () => {
    // Validate
    if (editStocks.some(s => !s.quantity || s.quantity <= 0)) {
      return toast.error("Quantity must be at least 1 for all batches");
    }

    setSavingStocks(true);
    try {
      await updateBoxItemStocks(box._id, activeItem.item._id, { stocks: editStocks });
      toast.success("Stocks updated successfully");
      setShowStocksModal(false);
      loadData(); // Reload to get fresh quantities and status
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update stocks");
    } finally {
      setSavingStocks(false);
    }
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
              <div className="table-container" style={{ border: 'none', overflowX: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Item</th><th>Qty</th><th>Req</th><th>Status</th><th>Nearest Expiry</th><th>Actions</th></tr></thead>
                  <tbody>
                    {box.items.map((item, i) => {
                      const qtyRatio = item.requiredQty > 0 ? item.currentQty / item.requiredQty : 1;
                      const qtyColor = qtyRatio >= 1 ? 'green' : qtyRatio >= 0.5 ? 'amber' : 'red';
                      
                      // Find nearest expiry from stocks
                      const nearestStock = item.stocks?.reduce((nearest, s) => {
                        if (!s.expiryDate) return nearest;
                        if (!nearest) return s;
                        return new Date(s.expiryDate) < new Date(nearest.expiryDate) ? s : nearest;
                      }, null);

                      const nearestExp = nearestStock?.expiryDate || item.expiryDate; // Fallback to legacy
                      
                      let expStatus = 'OK';
                      let expColor = 'green';
                      if (nearestExp) {
                        const daysLeft = Math.ceil((new Date(nearestExp) - new Date()) / (1000 * 60 * 60 * 24));
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
                          <td>{nearestExp ? <span className={`badge badge-${expColor}`}>{expStatus}</span> : '—'}</td>
                          <td>
                            <button 
                              className="btn btn-sm btn-ghost" 
                              onClick={() => openStocksModal(item)}
                              title="Manage Stocks"
                            >
                              <Edit2 size={16} /> Edit
                            </button>
                          </td>
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

      {/* Edit Stocks Modal */}
      {showStocksModal && activeItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h2>Manage Stocks: {activeItem.item?.name}</h2>
              <button className="btn-icon" onClick={() => setShowStocksModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16, padding: '12px', background: 'var(--bg-hover)', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <strong>Required Quantity:</strong> {activeItem.requiredQty} {activeItem.item?.unit} <br/>
                <strong>Current Total:</strong> {editStocks.reduce((sum, s) => sum + (Number(s.quantity)||0), 0)} {activeItem.item?.unit}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {editStocks.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No stock batches currently exist.</p>
                ) : (
                  editStocks.map((stock, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', position: 'relative' }}>
                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.8rem', marginBottom: 4 }}>Quantity</label>
                          <input type="number" className="form-control" min="1" value={stock.quantity} onChange={(e) => handleStockChange(i, 'quantity', e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.8rem', marginBottom: 4 }}>Expiry Date</label>
                          <input type="date" className="form-control" value={stock.expiryDate ? new Date(stock.expiryDate).toISOString().split('T')[0] : ''} onChange={(e) => handleStockChange(i, 'expiryDate', e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.8rem', marginBottom: 4 }}>Batch / Lot No. (Optional)</label>
                          <input type="text" className="form-control" value={stock.batchNumber || ''} onChange={(e) => handleStockChange(i, 'batchNumber', e.target.value)} placeholder="e.g. BATCH-123" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.8rem', marginBottom: 4 }}>Supplier (Optional)</label>
                          <input type="text" className="form-control" value={stock.supplier || ''} onChange={(e) => handleStockChange(i, 'supplier', e.target.value)} placeholder="Supplier name" />
                        </div>
                      </div>
                      <button className="btn-icon" style={{ color: '#EF4444', marginTop: '22px' }} onClick={() => handleRemoveStock(i)}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button className="btn btn-ghost" style={{ marginTop: 16, width: '100%', border: '1px dashed var(--border-color)' }} onClick={handleAddStock}>
                <Plus size={18} /> Add New Batch
              </button>
            </div>
            
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-secondary" onClick={() => setShowStocksModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveStocks} disabled={savingStocks}>
                {savingStocks ? 'Saving...' : <><Save size={18} /> Save Stocks</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoxProfile;
