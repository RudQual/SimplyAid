import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Building2, Pencil, Trash2, Users, Boxes, MapPin } from 'lucide-react';
import useAsync from '../hooks/useAsync';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../services/api';
import { PageHeader, StatusBadge, EmptyState, ErrorState, Skeleton, Modal, Field, Spinner, useConfirm } from '../components/ui';
import { errorMessage, labelize } from '../utils/format';

const RISK_TONE = { low: 'green', medium: 'amber', high: 'red', critical: 'red' };

const DeptModal = ({ open, dept, onClose, onSaved }) => {
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(dept ? { name: dept.name, code: dept.code, location: dept.location || '', floor: dept.floor || '', riskLevel: dept.riskLevel || 'medium', description: dept.description || '' }
      : { name: '', code: '', location: '', floor: '', riskLevel: 'medium', description: '' });
  }, [open, dept]);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };
  const submit = async () => {
    const er = {};
    if (form.name.trim().length < 2) er.name = 'Enter a name';
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(form.code.trim())) er.code = '1–20 letters or numbers';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const payload = { ...form, name: form.name.trim(), code: form.code.trim().toUpperCase() };
    try {
      const res = dept ? await updateDepartment(dept._id, payload) : await createDepartment(payload);
      toast.success(res.data.message); onSaved(); onClose();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title={dept ? `Edit ${dept.name}` : 'New department'}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? <Spinner size="sm" light /> : 'Save'}</button></>}>
      <div className="form-row">
        <Field label="Name" required error={errors.name}><input value={form.name || ''} onChange={set('name')} autoFocus /></Field>
        <Field label="Code" required error={errors.code}><input value={form.code || ''} onChange={set('code')} style={{ textTransform: 'uppercase' }} /></Field>
      </div>
      <div className="form-row">
        <Field label="Location"><input value={form.location || ''} onChange={set('location')} /></Field>
        <Field label="Risk level"><select value={form.riskLevel} onChange={set('riskLevel')}>{['low', 'medium', 'high', 'critical'].map((r) => <option key={r} value={r}>{labelize(r)}</option>)}</select></Field>
      </div>
      <Field label="Description"><textarea rows={2} value={form.description || ''} onChange={set('description')} /></Field>
    </Modal>
  );
};

const Departments = () => {
  const confirm = useConfirm();
  const [modal, setModal] = useState(null);
  const depts = useAsync(() => getDepartments(), [], { select: (r) => r.data.data });

  const remove = async (d) => {
    const ok = await confirm({ title: `Deactivate ${d.name}?`, message: 'Departments with active people or kits can’t be deactivated — reassign them first.', confirmLabel: 'Deactivate', tone: 'danger' });
    if (!ok) return;
    try { const res = await deleteDepartment(d._id); toast.success(res.data.message); depts.refresh(); } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="page-content">
      <PageHeader title="Departments" subtitle="Organisational units that own kits and people."
        actions={<button className="btn btn-primary" onClick={() => setModal({ dept: null })}><Plus size={16} /> New department</button>} />
      {depts.loading && <div className="grid-3">{Array.from({ length: 6 }).map((_, i) => <div className="card" key={i}><Skeleton height={110} /></div>)}</div>}
      {depts.error && <div className="card"><ErrorState error={depts.error} onRetry={depts.reload} /></div>}
      {depts.data && depts.data.length === 0 && <div className="card"><EmptyState icon={Building2} title="No departments yet" /></div>}
      {depts.data && depts.data.length > 0 && (
        <div className="grid-3">
          {depts.data.map((d) => (
            <div key={d._id} className="card">
              <div className="row-between">
                <div className="row"><span className="stat-icon tone-blue"><Building2 size={18} /></span><div><div className="strong">{d.name}</div><div className="xsmall muted">{d.code}</div></div></div>
                <StatusBadge value={RISK_TONE[d.riskLevel]} label={`${labelize(d.riskLevel)} risk`} />
              </div>
              <div className="stack-sm small muted" style={{ marginTop: 14 }}>
                {d.location && <span className="row"><MapPin size={14} /> {d.location}</span>}
                <span className="row"><Users size={14} /> <Link to={`/employees?department=${d._id}`}>{d.employeeCount} people</Link></span>
                <span className="row"><Boxes size={14} /> <Link to={`/kits?department=${d._id}`}>{d.kitCount} kits</Link></span>
                {d.headOfDepartment && <span>Head: {d.headOfDepartment.name}</span>}
              </div>
              <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setModal({ dept: d })}><Pencil size={14} /> Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(d)}><Trash2 size={14} /> Deactivate</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <DeptModal open={Boolean(modal)} dept={modal?.dept} onClose={() => setModal(null)} onSaved={() => depts.refresh()} />
    </div>
  );
};

export default Departments;
