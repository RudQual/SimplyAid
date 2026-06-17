import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUsers, getDepartments, registerUser } from '../services/api';
import { Search, Plus, X, UserPlus, Shield, Award, CreditCard, Eye, User } from 'lucide-react';
import toast from 'react-hot-toast';

const Employees = () => {
  const { t, hasRole, requireAuth } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', department: '', phone: '', designation: '' });

  useEffect(() => { load(); }, [search, filterDept, filterRole]);
  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterDept) params.department = filterDept;
      if (filterRole) params.role = filterRole;
      const [uRes, dRes] = await Promise.all([getUsers(params), getDepartments()]);
      setUsers(uRes.data.data); setDepts(dRes.data.data);
    } catch(e){} finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const userData = { ...form };
      // Get company from current user's data
      const stored = JSON.parse(localStorage.getItem('simplyaid_user') || '{}');
      userData.company = stored.company?._id || stored.company;
      // Employee ID is auto-generated on the backend — no manual input needed
      await registerUser(userData);
      toast.success('Employee added — ID and QR code auto-generated');
      setShowAdd(false);
      load();
      setForm({ name: '', email: '', password: '', role: 'employee', department: '', phone: '', designation: '' });
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to add'); }
  };

  const roleColors = { admin: 'purple', safety_officer: 'blue', first_aider: 'green', department_head: 'amber', employee: 'closed' };
  const statusColors = { active: 'green', on_leave: 'amber', suspended: 'red', resigned: 'closed' };

  const getStatus = (u) => u.employeeStatus || (u.isActive ? 'active' : 'resigned');

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">{t('nav.employees')}</h1><p className="page-subtitle">Manage workforce, certifications & digital ID cards</p></div>
        {hasRole('admin') && <button className="btn btn-primary" onClick={() => requireAuth(() => setShowAdd(true))}><UserPlus size={18} /> Add Employee</button>}
      </div>

      <div className="card" style={{marginBottom:20,padding:'16px 20px'}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:200,position:'relative'}}><Search size={16} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}} /><input placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} style={{paddingLeft:36}} /></div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{width:180}}><option value="">All Departments</option>{depts.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{width:180}}><option value="">All Roles</option><option value="admin">Admin</option><option value="safety_officer">Safety Officer</option><option value="first_aider">First Aider</option><option value="department_head">Dept Head</option><option value="employee">Employee</option></select>
        </div>
      </div>

      {loading ? <div className="page-loader"><div className="spinner"></div></div> : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Employee</th><th>ID</th><th>Role</th><th>Department</th><th>Designation</th><th>Status</th><th>Certified</th><th>Actions</th></tr></thead>
            <tbody>{users.map(u => {
              const status = getStatus(u);
              return (
                <tr key={u._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {u.profilePhoto ? (
                        <img src={u.profilePhoto} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #1e3a5f, #2d3a52)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontWeight: 700, fontSize: '0.8rem' }}>
                          {u.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontWeight: 600 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#3b82f6', fontWeight: 600, fontSize: '0.82rem' }}>{u.employeeId || '—'}</td>
                  <td><span className={`badge badge-${roleColors[u.role]}`}><Shield size={10} /> {u.role?.replace('_',' ')}</span></td>
                  <td>{u.department?.name || '—'}</td>
                  <td>{u.designation || '—'}</td>
                  <td>
                    <span className={`badge badge-${statusColors[status] || 'closed'}`} style={{ textTransform: 'capitalize' }}>
                      {status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{u.firstAidCertified ? <Award size={16} color="var(--success)" /> : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" title="View Profile" onClick={() => navigate(`/employees/${u._id}`)} style={{ padding: '4px 8px' }}>
                        <Eye size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm" title="View ID Card" onClick={() => navigate(`/employees/${u._id}/card`)} style={{ padding: '4px 8px' }}>
                        <CreditCard size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Add Employee</h3><button className="modal-close" onClick={() => setShowAdd(false)}><X size={18} /></button></div>
            <form onSubmit={handleAdd}>
              <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: '0.82rem', color: '#3b82f6' }}>
                💡 Employee ID and QR Code will be auto-generated after creation
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Full Name *</label><input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Email *</label><input type="email" required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Password *</label><input type="password" required value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Phone</label><input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Role</label><select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}><option value="employee">Employee</option><option value="first_aider">First Aider</option><option value="department_head">Dept Head</option><option value="safety_officer">Safety Officer</option><option value="admin">Admin</option></select></div>
                <div className="form-group"><label className="form-label">Department</label><select value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))}><option value="">Select</option>{depts.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Designation</label><input value={form.designation} onChange={e => setForm(f => ({...f, designation: e.target.value}))} /></div>
                <div className="form-group" />
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add Employee</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
