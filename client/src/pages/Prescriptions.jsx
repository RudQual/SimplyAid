import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getPrescriptions, createPrescription, updatePrescription, getUsers } from '../services/api';
import { FileText, Plus, X, Save, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import './Prescriptions.css';

const Prescriptions = () => {
  const { requireAuth } = useAuth();
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    employee: '', doctorName: '', doctorRegistrationNumber: '',
    issueDate: new Date().toISOString().split('T')[0], expiryDate: '',
    notes: '', medicines: [{ medicineName: '', strength: '', dosage: '', frequency: '', duration: '', instructions: '' }]
  });

  useEffect(() => { loadPrescriptions(); }, [page, statusFilter]);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      const res = await getPrescriptions(params);
      setPrescriptions(res.data.data);
      setTotalPages(res.data.pages || 1);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const openModal = async () => {
    try { const res = await getUsers(); setEmployees(res.data.data || []); } catch (e) {}
    setShowModal(true);
  };

  const addMedicine = () => {
    setForm(prev => ({ ...prev, medicines: [...prev.medicines, { medicineName: '', strength: '', dosage: '', frequency: '', duration: '', instructions: '' }] }));
  };

  const updateMedicine = (i, field, value) => {
    setForm(prev => { const m = [...prev.medicines]; m[i] = { ...m[i], [field]: value }; return { ...prev, medicines: m }; });
  };

  const removeMedicine = (i) => {
    setForm(prev => ({ ...prev, medicines: prev.medicines.filter((_, idx) => idx !== i) }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.employee || !form.doctorName || !form.medicines[0]?.medicineName) {
      toast.error('Please fill in required fields'); return;
    }
    try {
      setSaving(true);
      await createPrescription(form);
      toast.success('Prescription created');
      setShowModal(false);
      setForm({ employee: '', doctorName: '', doctorRegistrationNumber: '', issueDate: new Date().toISOString().split('T')[0], expiryDate: '', notes: '', medicines: [{ medicineName: '', strength: '', dosage: '', frequency: '', duration: '', instructions: '' }] });
      loadPrescriptions();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updatePrescription(id, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      loadPrescriptions();
    } catch (e) { toast.error('Failed to update status'); }
  };

  const statusBadge = (s) => {
    const map = { active: 'badge-green', completed: 'badge-blue', expired: 'badge-amber', cancelled: 'badge-red' };
    return map[s] || 'badge-blue';
  };

  if (loading && !prescriptions.length) return <div className="page-loader"><div className="spinner"></div></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Prescriptions</h1>
          <p className="page-subtitle">Digital prescription management</p>
        </div>
        <button className="btn btn-primary" onClick={() => requireAuth(() => openModal())}><Plus size={18} />New Prescription</button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="treatments-filters">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: 'auto', minWidth: 160 }}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {prescriptions.length > 0 ? (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>ID</th><th>Employee</th><th>Doctor</th><th>Issue Date</th><th>Medicines</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {prescriptions.map(p => (
                <tr key={p._id}>
                  <td style={{ fontWeight: 600, color: 'var(--blue-600)' }}>{p.prescriptionId}</td>
                  <td>
                    <div className="employee-cell">
                      <div className="employee-avatar-sm">{p.employee?.name?.charAt(0) || '?'}</div>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.employee?.name}</span>
                    </div>
                  </td>
                  <td>{p.doctorName}</td>
                  <td>{new Date(p.issueDate).toLocaleDateString()}</td>
                  <td>{p.medicines?.length || 0} item(s)</td>
                  <td><span className={`badge ${statusBadge(p.status)}`}>{p.status}</span></td>
                  <td>
                    {p.status === 'active' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleStatusChange(p._id, 'completed')}>Complete</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleStatusChange(p._id, 'cancelled')}>Cancel</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state"><FileText size={48} /><p>No prescriptions found</p></div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={16} />Prev</button>
          <span className="page-info">Page {page} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next<ChevronRight size={16} /></button>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Prescription</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Employee *</label>
                  <select value={form.employee} onChange={e => setForm(f => ({ ...f, employee: e.target.value }))} required>
                    <option value="">Select Employee</option>
                    {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Doctor Name *</label>
                  <input value={form.doctorName} onChange={e => setForm(f => ({ ...f, doctorName: e.target.value }))} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Registration No.</label>
                  <input value={form.doctorRegistrationNumber} onChange={e => setForm(f => ({ ...f, doctorRegistrationNumber: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Issue Date</label>
                  <input type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} />
                </div>
              </div>

              <div style={{ marginTop: 16, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ margin: 0 }}>Medicines *</label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addMedicine}><Plus size={14} />Add</button>
              </div>
              {form.medicines.map((med, i) => (
                <div key={i} className="prescription-medicine-row">
                  <input placeholder="Medicine Name *" value={med.medicineName} onChange={e => updateMedicine(i, 'medicineName', e.target.value)} required />
                  <input placeholder="Strength" value={med.strength} onChange={e => updateMedicine(i, 'strength', e.target.value)} />
                  <input placeholder="Dosage *" value={med.dosage} onChange={e => updateMedicine(i, 'dosage', e.target.value)} required />
                  <input placeholder="Frequency *" value={med.frequency} onChange={e => updateMedicine(i, 'frequency', e.target.value)} required />
                  <input placeholder="Duration" value={med.duration} onChange={e => updateMedicine(i, 'duration', e.target.value)} />
                  {form.medicines.length > 1 && <button type="button" className="remove-btn" onClick={() => removeMedicine(i)}><Trash2 size={14} /></button>}
                </div>
              ))}

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}><Save size={18} />{saving ? 'Saving...' : 'Create Prescription'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Prescriptions;
