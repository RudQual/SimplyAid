import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal, Field, Spinner } from '../ui';
import {
  restockBoxItem, dispenseBoxItem, adjustBoxItem, updateBoxItem, addBoxItem, getInventoryItems
} from '../../services/api';
import { errorMessage, formatDate, labelize, toInputDate } from '../../utils/format';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * One modal for every per-item stock action.
 * mode: 'restock' | 'dispense' | 'adjust' | 'require'
 */
export const StockActionModal = ({ open, mode, kit, item, onClose, onDone }) => {
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const name = item?.item?.name || 'Item';
  const unit = item?.item?.unit || 'units';

  useEffect(() => {
    if (!open || !item) return;
    setError(null);
    if (mode === 'restock') setForm({ quantity: Math.max(1, (item.requiredQty || 0) - (item.currentQty || 0)) || 1, batchNumber: '', expiryDate: '', supplier: '', manufacturingDate: '' });
    if (mode === 'dispense') setForm({ quantity: 1, reason: '' });
    if (mode === 'adjust') setForm({ stockId: item.stocks?.[0]?._id || '', quantity: item.stocks?.[0]?.quantity ?? 0, reason: '' });
    if (mode === 'require') setForm({ requiredQty: item.requiredQty ?? 0 });
  }, [open, mode, item]);

  if (!item) return null;
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(null); };
  const usable = (item.stocks || []).filter((s) => s.status !== 'expired').reduce((sum, s) => sum + s.quantity, 0);

  const submit = async (e) => {
    e?.preventDefault();
    const qty = Number(form.quantity);
    try {
      if (mode === 'restock') {
        if (!Number.isInteger(qty) || qty < 1) return setError('Enter a whole number of at least 1');
        if (form.expiryDate && form.expiryDate < today()) return setError('That expiry date has already passed');
      }
      if (mode === 'dispense') {
        if (!Number.isInteger(qty) || qty < 1) return setError('Enter a whole number of at least 1');
        if (qty > usable) return setError(`Only ${usable} usable ${unit} in this kit`);
      }
      if (mode === 'adjust') {
        if (!form.stockId) return setError('Choose a batch');
        if (!Number.isInteger(qty) || qty < 0) return setError('Enter a whole number of 0 or more');
        if ((form.reason || '').trim().length < 3) return setError('Explain why the quantity is being corrected');
      }
      if (mode === 'require') {
        const r = Number(form.requiredQty);
        if (!Number.isInteger(r) || r < 0) return setError('Enter a whole number of 0 or more');
      }
      setBusy(true);
      const id = kit._id;
      const itemId = item.item._id;
      let res;
      if (mode === 'restock') res = await restockBoxItem(id, itemId, { quantity: qty, batchNumber: form.batchNumber || undefined, expiryDate: form.expiryDate || undefined, supplier: form.supplier || undefined, manufacturingDate: form.manufacturingDate || undefined });
      if (mode === 'dispense') res = await dispenseBoxItem(id, itemId, { quantity: qty, reason: form.reason || undefined });
      if (mode === 'adjust') res = await adjustBoxItem(id, itemId, { stockId: form.stockId, quantity: qty, reason: form.reason.trim() });
      if (mode === 'require') res = await updateBoxItem(id, itemId, { requiredQty: Number(form.requiredQty) });
      toast.success(res.data.message || 'Saved');
      onDone(res.data.data);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Could not update stock'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const titles = {
    restock: [`Restock ${name}`, `Add a new batch to ${kit.boxId}. Currently ${item.currentQty} of ${item.requiredQty} required.`],
    dispense: [`Use ${name}`, `Record units taken from ${kit.boxId}. The batch expiring soonest is used first; expired units are never handed out.`],
    adjust: [`Correct stock of ${name}`, 'Use after a physical count when the recorded quantity is wrong. Every correction is logged.'],
    require: [`Required quantity for ${name}`, 'The minimum that must be in this kit. Falling below it raises a low-stock alert.']
  };
  const selectedBatch = (item.stocks || []).find((s) => s._id === form.stockId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={titles[mode]?.[0]}
      description={titles[mode]?.[1]}
      footer={(
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`btn ${mode === 'dispense' ? 'btn-teal' : 'btn-primary'}`} onClick={submit} disabled={busy}>
            {busy ? <Spinner size="sm" light /> : { restock: 'Add stock', dispense: 'Record usage', adjust: 'Save correction', require: 'Save' }[mode]}
          </button>
        </>
      )}
    >
      <form onSubmit={submit} noValidate>
        {error && <div className="alert alert-danger mb-16">{error}</div>}
        {mode === 'restock' && (
          <>
            <div className="form-row">
              <Field label={`Quantity (${unit})`} required><input type="number" min={1} step={1} value={form.quantity ?? ''} onChange={set('quantity')} autoFocus /></Field>
              <Field label="Expiry date" hint="Leave empty for items without expiry"><input type="date" min={today()} value={form.expiryDate || ''} onChange={set('expiryDate')} /></Field>
            </div>
            <div className="form-row">
              <Field label="Batch / lot number"><input value={form.batchNumber || ''} onChange={set('batchNumber')} placeholder="e.g. B25-1042" /></Field>
              <Field label="Supplier"><input value={form.supplier || ''} onChange={set('supplier')} /></Field>
            </div>
            <Field label="Manufacturing date"><input type="date" max={today()} value={form.manufacturingDate || ''} onChange={set('manufacturingDate')} /></Field>
          </>
        )}
        {mode === 'dispense' && (
          <>
            <Field label={`Quantity (${unit})`} required hint={`${usable} usable ${unit} available`}><input type="number" min={1} max={usable} step={1} value={form.quantity ?? ''} onChange={set('quantity')} autoFocus /></Field>
            <Field label="Reason / note"><input value={form.reason || ''} onChange={set('reason')} placeholder="e.g. Minor cut, Line 3" maxLength={500} /></Field>
          </>
        )}
        {mode === 'adjust' && (
          <>
            {(item.stocks || []).length === 0 ? <div className="alert alert-info">This item has no batches. Use “Restock” to add stock.</div> : (
              <>
                <Field label="Batch" required>
                  <select value={form.stockId} onChange={(e) => { const b = item.stocks.find((s) => s._id === e.target.value); setForm((f) => ({ ...f, stockId: e.target.value, quantity: b?.quantity ?? 0 })); }}>
                    {item.stocks.map((s) => <option key={s._id} value={s._id}>{s.batchNumber || 'No batch no.'} — {s.quantity} {unit}{s.expiryDate ? `, expires ${formatDate(s.expiryDate)}` : ''}</option>)}
                  </select>
                </Field>
                <Field label={`Counted quantity (${unit})`} required hint={selectedBatch ? `Currently recorded: ${selectedBatch.quantity}. Enter 0 to remove the batch.` : ''}>
                  <input type="number" min={0} step={1} value={form.quantity ?? ''} onChange={set('quantity')} />
                </Field>
                <Field label="Reason" required><input value={form.reason || ''} onChange={set('reason')} placeholder="e.g. Physical count during inspection" maxLength={500} /></Field>
              </>
            )}
          </>
        )}
        {mode === 'require' && (
          <Field label={`Required quantity (${unit})`} required><input type="number" min={0} step={1} value={form.requiredQty ?? ''} onChange={set('requiredQty')} autoFocus /></Field>
        )}
      </form>
    </Modal>
  );
};

/** Add a catalog item to a kit's contents. */
export const AddItemModal = ({ open, kit, onClose, onDone }) => {
  const [catalog, setCatalog] = useState([]);
  const [itemId, setItemId] = useState('');
  const [requiredQty, setRequiredQty] = useState(1);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItemId(''); setRequiredQty(1); setError(null);
    getInventoryItems().then((r) => {
      const present = new Set(kit.items.map((i) => i.item._id));
      setCatalog(r.data.data.filter((i) => !present.has(i._id)));
    }).catch((err) => setError(errorMessage(err, 'Could not load the catalog')));
  }, [open, kit]);

  const submit = async () => {
    if (!itemId) return setError('Choose an item');
    const r = Number(requiredQty);
    if (!Number.isInteger(r) || r < 0) return setError('Required quantity must be 0 or more');
    setBusy(true);
    try {
      const res = await addBoxItem(kit._id, { itemId, requiredQty: r });
      toast.success(res.data.message);
      onDone(res.data.data);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Could not add the item'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const chosen = catalog.find((c) => c._id === itemId);
  return (
    <Modal open={open} onClose={onClose} busy={busy} title={`Add item to ${kit?.boxId}`} description="Choose a supply from the inventory catalog and set the quantity this kit must hold."
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? <Spinner size="sm" light /> : 'Add item'}</button></>}>
      {error && <div className="alert alert-danger mb-16">{error}</div>}
      {catalog.length === 0 && !error ? <p className="muted">Every catalog item is already in this kit. Add new supplies on the Inventory page first.</p> : (
        <>
          <Field label="Item" required>
            <select value={itemId} onChange={(e) => {
              setItemId(e.target.value);
              const c = catalog.find((x) => x._id === e.target.value);
              if (c) setRequiredQty(c.requiredQty?.[`class${kit.classType}`] || 1);
            }}>
              <option value="">Select an item…</option>
              {catalog.map((c) => <option key={c._id} value={c._id}>{c.name} ({labelize(c.category)})</option>)}
            </select>
          </Field>
          <Field label={`Required quantity${chosen ? ` (${chosen.unit})` : ''}`} required><input type="number" min={0} value={requiredQty} onChange={(e) => setRequiredQty(e.target.value)} /></Field>
        </>
      )}
    </Modal>
  );
};

export { toInputDate };
