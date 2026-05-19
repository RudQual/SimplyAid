import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../services/api';
import { Plus, X, Edit2, Trash2, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

const RISK_COLORS = { low: 'green', medium: 'amber', high: 'red', critical: 'fatal' };

const Departments = () => {
  const { t } = useAuth();
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', location: '', workerCount: '', riskLevel: 'medium', description: '' });

  useEffect(() => { load(); }, []);
  const load = async () => { try { const r = await getDepartments(); setDepts(r.data.data); } catch(e){} finally { setLoading(false); } };

  const openAdd = () => { setForm({ name: '', code: '', location: '', workerCount: '', riskLevel: 'medium', description: '' }); setEditing(null); setShowModal(true); };
  const openEdit = (d) => { setForm({ name: d.name, code: d.code, location: d.location || '', workerCount: d.workerCount || '', riskLevel: d.riskLevel, description: d.description || '' }); setEditing(d._id); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await updateDepartment(editing, { ...form, workerCount: parseInt(form.workerCount) || 0 }); toast.success('Updated'); }
      else { await createDepartment({ ...form, workerCount: parseInt(form.workerCount) || 0 }); toast.success('Created'); }
      setShowModal(false); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this department?')) return;
    try { await deleteDepartment(id); toast.success('Deactivated'); load(); } catch(e) { toast.error('Failed'); }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">{t('nav.departments')}</h1><p className="page-subtitle">Manage organizational departments</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Department</button>
      </div>
      {loading ? <div className="page-loader"><div className="spinner"></div></div> : (
        <div className="grid-3">{depts.map(d => (
          <div key={d._id} className="card">
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <div style={{width:40,height:40,borderRadius:10,background:'rgba(99,102,241,0.1)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--info)'}}><Building2 size={20} /></div>
                <div><div style={{fontWeight:700}}>{d.name}</div><div style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>{d.code}</div></div>
              </div>
              <div style={{display:'flex',gap:4}}>
                <button className="btn btn-ghost btn-sm" style={{padding:6}} onClick={() => openEdit(d)}><Edit2 size={14} /></button>
                <button className="btn btn-ghost btn-sm" style={{padding:6}} onClick={() => handleDelete(d._id)}><Trash2 size={14} /></button>
              </div>
            </div>
            <div style={{fontSize:'0.85rem',color:'var(--text-secondary)',display:'flex',flexDirection:'column',gap:4}}>
              <div>Location: {d.location || '-'}</div>
              <div>Workers: {d.workerCount}</div>
              <div>Risk: <span className={`badge badge-${RISK_COLORS[d.riskLevel]}`}>{d.riskLevel}</span></div>
              {d.headOfDepartment && <div>Head: {d.headOfDepartment.name}</div>}
            </div>
          </div>
        ))}</div>
      )}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">{editing ? 'Edit' : 'Add'} Department</h3><button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-row"><div className="form-group"><label className="form-label">Name *</label><input required value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} /></div><div className="form-group"><label className="form-label">Code *</label><input required value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value.toUpperCase()}))} /></div></div>
              <div className="form-row"><div className="form-group"><label className="form-label">Location</label><input value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} /></div><div className="form-group"><label className="form-label">Workers</label><input type="number" value={form.workerCount} onChange={e => setForm(f=>({...f,workerCount:e.target.value}))} /></div></div>
              <div className="form-group"><label className="form-label">Risk Level</label><select value={form.riskLevel} onChange={e => setForm(f=>({...f,riskLevel:e.target.value}))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
              <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Departments;
