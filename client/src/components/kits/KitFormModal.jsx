import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal, Field, Spinner } from '../ui';
import { createBox, updateBox, getDepartments, getUsers } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { errorMessage } from '../../utils/format';

const EMPTY = { boxId: '', location: '', floor: '', department: '', classType: 'B', inCharge: '', inspectionFrequencyDays: 30, riskCategory: 'medium' };

/** Create or edit a first aid kit. */
const KitFormModal = ({ open, onClose, kit, onSaved }) => {
  const { user } = useAuth();
  const isEdit = Boolean(kit);
  const [form, setForm] = useState(EMPTY);
  const [departments, setDepartments] = useState([]);
  const [people, setPeople] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(kit ? {
      boxId: kit.boxId,
      location: kit.location || '',
      floor: kit.floor || '',
      department: kit.department?._id || kit.department || '',
      classType: kit.classType || 'B',
      inCharge: kit.inCharge?._id || kit.inCharge || '',
      inspectionFrequencyDays: kit.inspectionFrequencyDays || 30,
      riskCategory: kit.riskCategory || 'medium'
    } : { ...EMPTY, department: user.role === 'manager' ? (user.department?._id || '') : '' });
    getDepartments().then((r) => setDepartments(r.data.data)).catch(() => toast.error('Could not load departments'));
    getUsers({ isActive: 'true' }).then((r) => setPeople(r.data.data)).catch(() => setPeople([]));
  }, [open, kit, user]);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const validate = () => {
    const er = {};
    if (!isEdit && !/^[A-Za-z0-9_-]{2,40}$/.test(form.boxId.trim())) er.boxId = 'Use 2–40 letters, numbers, - or _';
    if (form.location.trim().length < 2) er.location = 'Location is required';
    if (!form.department) er.department = 'Choose a department';
    const freq = Number(form.inspectionFrequencyDays);
    if (!Number.isInteger(freq) || freq < 1 || freq > 365) er.inspectionFrequencyDays = 'Between 1 and 365 days';
    setErrors(er);
    return !Object.keys(er).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    const payload = {
      location: form.location.trim(),
      floor: form.floor.trim(),
      department: form.department,
      classType: form.classType,
      inCharge: form.inCharge || null,
      inspectionFrequencyDays: Number(form.inspectionFrequencyDays),
      riskCategory: form.riskCategory
    };
    try {
      const res = isEdit ? await updateBox(kit._id, payload) : await createBox({ ...payload, boxId: form.boxId.trim().toUpperCase() });
      toast.success(res.data.message || 'Saved');
      onSaved(res.data.data);
      onClose();
    } catch (err) {
      const msg = errorMessage(err, 'Could not save the kit');
      if (/kit id/i.test(msg)) setErrors({ boxId: msg }); else toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const certified = people.filter((p) => p.firstAidCertified);
  const others = people.filter((p) => !p.firstAidCertified);

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      size="lg"
      title={isEdit ? `Edit kit ${kit.boxId}` : 'New first aid kit'}
      description={isEdit ? 'Update where the kit is and who is responsible for it.' : 'The contents list is created from the statutory quantities for the selected class. You can adjust it afterwards.'}
      footer={(
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? <Spinner size="sm" light /> : isEdit ? 'Save changes' : 'Create kit'}</button>
        </>
      )}
    >
      <form onSubmit={submit} noValidate>
        <div className="form-row">
          <Field label="Kit ID" required error={errors.boxId} hint={isEdit ? 'The kit ID cannot be changed.' : 'Printed on the kit label, e.g. FAB-PROD-004'}>
            <input value={form.boxId} onChange={set('boxId')} disabled={isEdit} placeholder="FAB-PROD-004" style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field label="Department" required error={errors.department}>
            <select value={form.department} onChange={set('department')} disabled={user.role === 'manager'}>
              <option value="">Select department…</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Location" required error={errors.location}><input value={form.location} onChange={set('location')} placeholder="Assembly line, near fire exit" /></Field>
          <Field label="Floor"><input value={form.floor} onChange={set('floor')} placeholder="Ground" /></Field>
        </div>
        <div className="form-row-3">
          <Field label="Kit class" hint="A ≤ 50, B ≤ 150, C > 150 workers">
            <select value={form.classType} onChange={set('classType')}>
              <option value="A">Class A</option><option value="B">Class B</option><option value="C">Class C</option>
            </select>
          </Field>
          <Field label="Inspect every (days)" required error={errors.inspectionFrequencyDays}>
            <input type="number" min={1} max={365} value={form.inspectionFrequencyDays} onChange={set('inspectionFrequencyDays')} />
          </Field>
          <Field label="Risk category">
            <select value={form.riskCategory} onChange={set('riskCategory')}>
              {['low', 'medium', 'high', 'critical'].map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Person in charge" hint="Section 45(2): each kit must be in charge of a trained first-aider.">
          <select value={form.inCharge} onChange={set('inCharge')}>
            <option value="">Unassigned</option>
            {certified.length > 0 && <optgroup label="Certified first-aiders">{certified.map((p) => <option key={p._id} value={p._id}>{p.name}{p.department?.name ? ` — ${p.department.name}` : ''}</option>)}</optgroup>}
            {others.length > 0 && <optgroup label="Not certified">{others.map((p) => <option key={p._id} value={p._id}>{p.name}{p.department?.name ? ` — ${p.department.name}` : ''}</option>)}</optgroup>}
          </select>
        </Field>
      </form>
    </Modal>
  );
};

export default KitFormModal;
