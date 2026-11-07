import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus, Users, MoreHorizontal, Pencil, KeyRound, UserX, UserCheck, IdCard, BadgeCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import useAsync from '../hooks/useAsync';
import { getUsers, getDepartments, createUser, updateUser, setUserStatus, resetUserPassword } from '../services/api';
import { PageHeader, SearchInput, StatusBadge, EmptyState, ErrorState, SkeletonRows, Pagination, Modal, Field, Spinner, useConfirm } from '../components/ui';
import { labelize, formatDate, timeAgo, errorMessage, initials, toInputDate } from '../utils/format';

const LIMIT = 20;
const strongPw = (pw) => pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

const UserFormModal = ({ open, onClose, user: target, departments, onSaved }) => {
  const { user: me } = useAuth();
  const isEdit = Boolean(target);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const roleOptions = me.role === 'admin' ? ['employee', 'manager', 'doctor', 'admin'] : ['employee', 'manager', 'doctor'];
  const canAssignRole = ['admin', 'doctor'].includes(me.role) && (!isEdit || (target._id !== me._id && (target.role !== 'admin' || me.role === 'admin')));

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(target ? {
      name: target.name, email: target.email, role: target.role, department: target.department?._id || '', employeeId: target.employeeId || '',
      designation: target.designation || '', phone: target.phone || '', firstAidCertified: Boolean(target.firstAidCertified),
      certificationExpiry: toInputDate(target.certificationExpiry)
    } : {
      name: '', email: '', password: '', role: 'employee', department: me.role === 'manager' ? me.department?._id : '', employeeId: '',
      designation: '', phone: '', firstAidCertified: false, certificationExpiry: ''
    });
  }, [open, target, me]);

  const set = (k) => (e) => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setForm((f) => ({ ...f, [k]: v })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const submit = async () => {
    const er = {};
    if ((form.name || '').trim().length < 2) er.name = 'Enter the full name';
    if (!isEdit && !/^\S+@\S+\.\S+$/.test(form.email || '')) er.email = 'Enter a valid email';
    if (!isEdit && !strongPw(form.password || '')) er.password = 'At least 8 characters with a letter and a number';
    if (form.firstAidCertified && !form.certificationExpiry) er.certificationExpiry = 'Enter when the certification expires';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const payload = {
      name: form.name.trim(), department: form.department || null, employeeId: form.employeeId.trim() || undefined,
      designation: form.designation.trim(), phone: form.phone.trim(), firstAidCertified: form.firstAidCertified,
      certificationExpiry: form.certificationExpiry || null
    };
    if (canAssignRole) payload.role = form.role;
    try {
      const res = isEdit ? await updateUser(target._id, payload) : await createUser({ ...payload, email: form.email.trim(), password: form.password });
      toast.success(res.data.message);
      onSaved(res.data.data);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} busy={busy} size="lg" title={isEdit ? `Edit ${target.name}` : 'Add a person'}
      description={isEdit ? 'Update employment, role and first-aid certification details.' : 'They can sign in immediately with the email and temporary password you set.'}
      footer={<><button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? <Spinner size="sm" light /> : isEdit ? 'Save changes' : 'Create account'}</button></>}>
      <div className="form-row">
        <Field label="Full name" required error={errors.name}><input value={form.name || ''} onChange={set('name')} autoFocus /></Field>
        <Field label="Email" required={!isEdit} error={errors.email} hint={isEdit ? 'Email can’t be changed here.' : ''}><input type="email" value={form.email || ''} onChange={set('email')} disabled={isEdit} /></Field>
      </div>
      {!isEdit && <Field label="Temporary password" required error={errors.password} hint="Share it securely; they should change it after first sign-in."><input type="text" value={form.password || ''} onChange={set('password')} autoComplete="new-password" /></Field>}
      <div className="form-row">
        <Field label="Role" hint={!canAssignRole ? (isEdit && target._id === me._id ? 'You can’t change your own role.' : 'Only administrators and doctors assign roles.') : 'Determines what this person can see and do.'}>
          <select value={form.role || 'employee'} onChange={set('role')} disabled={!canAssignRole}>{(canAssignRole ? roleOptions : [form.role]).map((r) => <option key={r} value={r}>{labelize(r)}</option>)}</select>
        </Field>
        <Field label="Department">
          <select value={form.department || ''} onChange={set('department')} disabled={me.role === 'manager'}>
            <option value="">No department</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="form-row-3">
        <Field label="Employee ID" hint={isEdit ? '' : 'Auto-generated if empty'}><input value={form.employeeId || ''} onChange={set('employeeId')} /></Field>
        <Field label="Designation"><input value={form.designation || ''} onChange={set('designation')} /></Field>
        <Field label="Phone"><input value={form.phone || ''} onChange={set('phone')} /></Field>
      </div>
      <div className="form-row">
        <div style={{ paddingTop: 28 }}><label className="checkbox-row"><input type="checkbox" checked={Boolean(form.firstAidCertified)} onChange={set('firstAidCertified')} /> Certified first-aider</label></div>
        <Field label="Certification expiry" error={errors.certificationExpiry}><input type="date" value={form.certificationExpiry || ''} onChange={set('certificationExpiry')} disabled={!form.firstAidCertified} /></Field>
      </div>
    </Modal>
  );
};

const ResetPasswordModal = ({ open, user: target, onClose }) => {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setPw(''); setError(null); } }, [open]);
  const submit = async () => {
    if (!strongPw(pw)) return setError('At least 8 characters with a letter and a number');
    setBusy(true);
    try { const res = await resetUserPassword(target._id, pw); toast.success(res.data.message); onClose(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
    return undefined;
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} size="sm" title={`Reset password for ${target?.name}`} description="Their current sessions will be signed out."
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? <Spinner size="sm" light /> : 'Reset password'}</button></>}>
      <Field label="New temporary password" error={error}><input type="text" value={pw} onChange={(e) => { setPw(e.target.value); setError(null); }} autoFocus autoComplete="new-password" /></Field>
    </Modal>
  );
};

const RowMenu = ({ target, onEdit, onReset, onToggle }) => {
  const { user: me, can } = useAuth();
  const [open, setOpen] = useState(false);
  const isMe = target._id === me._id;
  const adminLocked = target.role === 'admin' && me.role !== 'admin';
  return (
    <div className="dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button className="btn btn-ghost btn-xs btn-icon" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} aria-label="Actions"><MoreHorizontal size={16} /></button>
      {open && (
        <div className="dropdown-menu" style={{ minWidth: 200 }} onClick={(e) => e.stopPropagation()}>
          {!adminLocked && <button className="dropdown-item" onClick={() => { setOpen(false); onEdit(); }}><Pencil size={15} /> Edit details</button>}
          <Link className="dropdown-item" to={`/employees/${target._id}/card`}><IdCard size={15} /> ID card</Link>
          {can('manageUsers') && !isMe && !adminLocked && (
            <>
              <button className="dropdown-item" onClick={() => { setOpen(false); onReset(); }}><KeyRound size={15} /> Reset password</button>
              <div className="dropdown-divider" />
              <button className={`dropdown-item ${target.isActive ? 'danger' : ''}`} onClick={() => { setOpen(false); onToggle(); }}>
                {target.isActive ? <><UserX size={15} /> Deactivate</> : <><UserCheck size={15} /> Reactivate</>}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const Employees = () => {
  const { can } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [modal, setModal] = useState(null); // { type: 'create'|'edit'|'reset', user }
  const f = {
    search: params.get('search') || '', role: params.get('role') || '', department: params.get('department') || '',
    isActive: params.get('isActive') || 'true', certified: params.get('certified') || '', page: Number(params.get('page')) || 1
  };
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const depts = useAsync(() => getDepartments(), [], { select: (r) => r.data.data });
  const users = useAsync(() => getUsers(Object.fromEntries(Object.entries({ ...f, limit: LIMIT }).filter(([, v]) => v))), [params.toString()]);

  const toggleActive = async (u) => {
    const ok = await confirm({
      title: u.isActive ? `Deactivate ${u.name}?` : `Reactivate ${u.name}?`,
      message: u.isActive ? 'They will be signed out and unable to sign in. Their records are kept.' : 'They will be able to sign in again.',
      confirmLabel: u.isActive ? 'Deactivate' : 'Reactivate', tone: u.isActive ? 'danger' : 'primary'
    });
    if (!ok) return;
    try { const res = await setUserStatus(u._id, !u.isActive); toast.success(res.data.message); users.refresh(); } catch (err) { toast.error(errorMessage(err)); }
  };

  const rows = users.data?.data || [];
  return (
    <div className="page-content">
      <PageHeader title="People" subtitle="Accounts, roles and first-aid certifications."
        actions={can('manageUsers') && <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}><UserPlus size={16} /> Add person</button>} />
      <div className="card card-flush">
        <div className="toolbar">
          <SearchInput value={f.search} onChange={(v) => setFilter('search', v)} placeholder="Search name, email, ID…" />
          <select value={f.role} onChange={(e) => setFilter('role', e.target.value)} aria-label="Role"><option value="">All roles</option>{['admin', 'doctor', 'manager', 'employee'].map((r) => <option key={r} value={r}>{labelize(r)}</option>)}</select>
          <select value={f.department} onChange={(e) => setFilter('department', e.target.value)} aria-label="Department"><option value="">All departments</option>{(depts.data || []).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select>
          <select value={f.certified} onChange={(e) => setFilter('certified', e.target.value)} aria-label="Certification"><option value="">Any certification</option><option value="true">Certified first-aiders</option><option value="false">Not certified</option></select>
          <select value={f.isActive} onChange={(e) => setFilter('isActive', e.target.value)} aria-label="Status"><option value="true">Active</option><option value="false">Deactivated</option><option value="all">Everyone</option></select>
        </div>
        {users.loading && !users.data && <SkeletonRows rows={10} cols={5} />}
        {users.error && <ErrorState error={users.error} onRetry={users.reload} />}
        {users.data && rows.length === 0 && <EmptyState icon={Users} title="No people found" />}
        {rows.length > 0 && (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Role</th><th className="hide-sm">Department</th><th>First aid</th><th className="hide-sm">Last sign-in</th><th>Status</th><th className="actions" /></tr></thead>
              <tbody>
                {rows.map((u) => {
                  const certValid = u.firstAidCertified && (!u.certificationExpiry || new Date(u.certificationExpiry) > new Date());
                  return (
                    <tr key={u._id} className="clickable" onClick={() => navigate(`/employees/${u._id}`)}>
                      <td>
                        <div className="row">
                          <span className="avatar avatar-sm">{u.profilePhoto ? <img src={u.profilePhoto} alt="" /> : initials(u.name)}</span>
                          <div style={{ minWidth: 0 }}><div className="cell-primary truncate">{u.name}</div><div className="cell-sub truncate">{u.employeeId ? `${u.employeeId} · ` : ''}{u.email}</div></div>
                        </div>
                      </td>
                      <td><span className={`badge badge-${u.role}`}>{labelize(u.role)}</span></td>
                      <td className="hide-sm">{u.department?.name || <span className="faint">—</span>}<div className="cell-sub">{u.designation}</div></td>
                      <td>{u.firstAidCertified ? (certValid ? <span className="badge badge-green"><BadgeCheck size={12} /> Until {formatDate(u.certificationExpiry)}</span> : <span className="badge badge-red">Expired</span>) : <span className="faint small">—</span>}</td>
                      <td className="small muted hide-sm">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
                      <td><StatusBadge value={u.isActive ? 'active' : 'inactive'} label={u.isActive ? 'Active' : 'Deactivated'} /></td>
                      <td className="actions" onClick={(e) => e.stopPropagation()}>
                        <RowMenu target={u} onEdit={() => setModal({ type: 'edit', user: u })} onReset={() => setModal({ type: 'reset', user: u })} onToggle={() => toggleActive(u)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {users.data && <Pagination page={users.data.currentPage} pages={users.data.pages} total={users.data.total} limit={LIMIT} onChange={(p) => setFilter('page', String(p))} />}
      </div>
      <UserFormModal open={modal?.type === 'create' || modal?.type === 'edit'} user={modal?.type === 'edit' ? modal.user : null} departments={depts.data || []} onClose={() => setModal(null)} onSaved={() => users.refresh()} />
      <ResetPasswordModal open={modal?.type === 'reset'} user={modal?.user} onClose={() => setModal(null)} />
    </div>
  );
};

export default Employees;
