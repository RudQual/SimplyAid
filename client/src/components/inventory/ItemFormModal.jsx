import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal, Field, Spinner } from '../ui';
import { createInventoryItem, updateInventoryItem } from '../../services/api';
import { CATEGORIES, errorMessage, labelize } from '../../utils/format';

const EMPTY = {
  name: '', category: 'dressing', unit: 'pcs', description: '', isMandatory: false, requiresExpiryTracking: true,
  defaultShelfLifeDays: 365, classA: 0, classB: 0, classC: 0
};

const ItemFormModal = ({ open, item, onClose, onSaved }) => {
  const isEdit = Boolean(item);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(item ? {
      name: item.name, category: item.category, unit: item.unit, description: item.description || '',
      isMandatory: Boolean(item.isMandatory), requiresExpiryTracking: item.requiresExpiryTracking !== false,
      defaultShelfLifeDays: item.defaultShelfLifeDays ?? 365,
      classA: item.requiredQty?.classA ?? 0, classB: item.requiredQty?.classB ?? 0, classC: item.requiredQty?.classC ?? 0
    } : EMPTY);
  }, [open, item]);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e) => {
    e?.preventDefault();
    const er = {};
    if (form.name.trim().length < 2) er.name = 'Name must be at least 2 characters';
    if (!form.unit.trim()) er.unit = 'Unit is required';
    ['classA', 'classB', 'classC', 'defaultShelfLifeDays'].forEach((k) => {
      const n = Number(form[k]);
      if (!Number.isInteger(n) || n < 0) er[k] = 'Whole number, 0 or more';
    });
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const payload = {
      name: form.name.trim(), category: form.category, unit: form.unit.trim(), description: form.description.trim(),
      isMandatory: form.isMandatory, requiresExpiryTracking: form.requiresExpiryTracking,
      defaultShelfLifeDays: Number(form.defaultShelfLifeDays),
      requiredQty: { classA: Number(form.classA), classB: Number(form.classB), classC: Number(form.classC) }
    };
    try {
      const res = isEdit ? await updateInventoryItem(item._id, payload) : await createInventoryItem(payload);
      toast.success(res.data.message || 'Saved');
      onSaved(res.data.data);
      onClose();
    } catch (err) {
      const msg = errorMessage(err, 'Could not save the item');
      if (/already exists/i.test(msg)) setErrors({ name: msg }); else toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} busy={busy} size="lg"
      title={isEdit ? `Edit ${item.name}` : 'New inventory item'}
      description="Catalog entries describe a supply. Stock is added to individual kits."
      footer={<><button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? <Spinner size="sm" light /> : isEdit ? 'Save changes' : 'Create item'}</button></>}>
      <form onSubmit={submit} noValidate>
        <div className="form-row">
          <Field label="Name" required error={errors.name}><input value={form.name} onChange={set('name')} placeholder="Sterile gauze pad (10cm)" autoFocus /></Field>
          <div className="form-row" style={{ gap: '0 12px' }}>
            <Field label="Category" required>
              <select value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c} value={c}>{labelize(c)}</option>)}</select>
            </Field>
            <Field label="Unit" required error={errors.unit}><input value={form.unit} onChange={set('unit')} placeholder="pcs, rolls, bottles" /></Field>
          </div>
        </div>
        <Field label="Description"><textarea value={form.description} onChange={set('description')} rows={2} maxLength={1000} /></Field>
        <div className="form-section-title" style={{ marginTop: 8 }}>Required quantity per kit class</div>
        <p className="form-hint" style={{ marginTop: -8, marginBottom: 12 }}>New kits of each class are created with these quantities. Use 0 if the item isn’t required for that class.</p>
        <div className="form-row-3">
          <Field label="Class A" error={errors.classA}><input type="number" min={0} value={form.classA} onChange={set('classA')} /></Field>
          <Field label="Class B" error={errors.classB}><input type="number" min={0} value={form.classB} onChange={set('classB')} /></Field>
          <Field label="Class C" error={errors.classC}><input type="number" min={0} value={form.classC} onChange={set('classC')} /></Field>
        </div>
        <div className="form-row">
          <Field label="Typical shelf life (days)" error={errors.defaultShelfLifeDays}><input type="number" min={0} value={form.defaultShelfLifeDays} onChange={set('defaultShelfLifeDays')} /></Field>
          <div className="stack-sm" style={{ paddingTop: 26 }}>
            <label className="checkbox-row"><input type="checkbox" checked={form.isMandatory} onChange={set('isMandatory')} /> Mandatory (statutory) item</label>
            <label className="checkbox-row"><input type="checkbox" checked={form.requiresExpiryTracking} onChange={set('requiresExpiryTracking')} /> Track expiry dates</label>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default ItemFormModal;
