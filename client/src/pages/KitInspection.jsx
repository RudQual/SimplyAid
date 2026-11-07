import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2, CheckCircle2, AlertTriangle, ClipboardCheck } from 'lucide-react';
import useAsync from '../hooks/useAsync';
import { getBox, createInspection } from '../services/api';
import { PageHeader, Card, Field, StatusBadge, PageLoader, ErrorState, Spinner } from '../components/ui';
import { errorMessage, labelize } from '../utils/format';

const RESULTS = [
  { value: 'adequate', label: 'Adequate', hint: 'Everything required is present and in date' },
  { value: 'needs_replenishment', label: 'Needs replenishment', hint: 'Some items are short' },
  { value: 'items_expired', label: 'Items expired', hint: 'Expired supplies found' },
  { value: 'failed', label: 'Failed', hint: 'Kit unusable (damaged, missing, inaccessible)' }
];

const KitInspection = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const kit = useAsync(() => getBox(id), [id], { select: (r) => r.data.data });
  const [checklist, setChecklist] = useState([]);
  const [deficiencies, setDeficiencies] = useState([]);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!kit.data) return;
    setChecklist(kit.data.items.map((i) => ({
      itemName: i.item.name,
      checked: i.requiredQty === 0 || (i.currentQty >= i.requiredQty && i.expiryStatus !== 'expired'),
      notes: '',
      info: `${i.currentQty}/${i.requiredQty} ${i.item.unit}${i.expiryStatus === 'expired' ? ' · expired stock' : ''}`
    })));
  }, [kit.data]);

  const suggested = useMemo(() => {
    if (!kit.data) return 'adequate';
    if (kit.data.health?.expiredUnits) return 'items_expired';
    if (checklist.some((c) => !c.checked) || kit.data.health?.lowStockItems) return 'needs_replenishment';
    return 'adequate';
  }, [kit.data, checklist]);

  if (kit.loading) return <PageLoader />;
  if (kit.error) return <div className="page-content"><div className="card"><ErrorState error={kit.error} onRetry={kit.reload} /></div></div>;
  const k = kit.data;
  const finalStatus = status || suggested;
  const unchecked = checklist.filter((c) => !c.checked).length;

  const submit = async () => {
    if (deficiencies.some((d) => !d.description.trim())) return setError('Describe each deficiency or remove the empty row');
    setBusy(true);
    setError(null);
    try {
      const res = await createInspection({
        firstAidBox: k._id,
        status: finalStatus,
        checklist: checklist.map(({ itemName, checked, notes: n }) => ({ itemName, checked, notes: n || undefined })),
        deficiencies: deficiencies.map((d) => ({ description: d.description.trim(), severity: d.severity })),
        overallNotes: notes.trim() || undefined
      });
      toast.success(res.data.message);
      navigate(`/inspections/${res.data.data._id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not save the inspection'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <div className="page-content" style={{ maxWidth: 1000 }}>
      <PageHeader
        back={{ to: `/kits/${k._id}`, label: k.boxId }}
        title={`Inspect ${k.boxId}`}
        subtitle={`${k.location} · Class ${k.classType} · every ${k.inspectionFrequencyDays} days`}
      />
      {error && <div className="alert alert-danger mb-16"><AlertTriangle size={16} /> {error}</div>}

      <div className="stack">
        <Card title="Checklist" subtitle="Pre-filled from the recorded stock. Untick anything you find missing, damaged or expired.">
          <div className="stack-sm">
            {checklist.map((c, idx) => (
              <div key={c.itemName} className="row wrap" style={{ padding: '8px 10px', borderRadius: 8, background: c.checked ? 'transparent' : 'var(--warning-50)', border: '1px solid var(--slate-150)' }}>
                <label className="checkbox-row" style={{ flex: '1 1 260px' }}>
                  <input type="checkbox" checked={c.checked} onChange={(e) => setChecklist((l) => l.map((x, i) => (i === idx ? { ...x, checked: e.target.checked } : x)))} />
                  <span><strong>{c.itemName}</strong> <span className="xsmall muted">· {c.info}</span></span>
                </label>
                <input style={{ flex: '1 1 220px', minHeight: 32, padding: '5px 10px' }} placeholder="Note (optional)" value={c.notes}
                  onChange={(e) => setChecklist((l) => l.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x)))} />
              </div>
            ))}
          </div>
          <p className="small muted mt-16">{checklist.length - unchecked} of {checklist.length} items OK</p>
        </Card>

        <Card title="Deficiencies" subtitle="Problems that need follow-up. Each one can be marked resolved later."
          actions={<button className="btn btn-secondary btn-sm" onClick={() => setDeficiencies((d) => [...d, { description: '', severity: 'minor' }])}><Plus size={15} /> Add deficiency</button>}>
          {deficiencies.length === 0 ? <p className="small muted">No deficiencies recorded.</p> : (
            <div className="stack-sm">
              {deficiencies.map((d, idx) => (
                <div key={idx} className="row wrap">
                  <input style={{ flex: '1 1 300px' }} placeholder="e.g. Kit seal broken, eye wash bottle cracked" value={d.description}
                    onChange={(e) => setDeficiencies((l) => l.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))} maxLength={500} />
                  <select style={{ width: 150 }} value={d.severity} onChange={(e) => setDeficiencies((l) => l.map((x, i) => (i === idx ? { ...x, severity: e.target.value } : x)))}>
                    {['minor', 'moderate', 'serious', 'critical'].map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeficiencies((l) => l.filter((_, i) => i !== idx))} aria-label="Remove deficiency"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Result">
          <div className="grid-2" style={{ gap: 10, marginBottom: 16 }}>
            {RESULTS.map((r) => (
              <button key={r.value} type="button" onClick={() => setStatus(r.value)}
                className="card" style={{ textAlign: 'left', padding: 14, borderColor: finalStatus === r.value ? 'var(--brand-500)' : undefined, boxShadow: finalStatus === r.value ? 'var(--focus-ring)' : undefined }}>
                <div className="row-between"><strong>{r.label}</strong>{r.value === suggested && <span className="badge badge-blue">Suggested</span>}</div>
                <div className="small muted">{r.hint}</div>
              </button>
            ))}
          </div>
          <Field label="Inspector notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Overall observations, follow-up required…" /></Field>
          <div className="row-between wrap">
            <span className="small muted">Result: <StatusBadge value={finalStatus === 'adequate' ? 'adequate' : finalStatus} label={labelize(finalStatus)} /> · Next inspection will be due in {k.inspectionFrequencyDays} days.</span>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? <Spinner size="sm" light /> : <><ClipboardCheck size={16} /> Save inspection</>}</button>
          </div>
        </Card>
      </div>
      {finalStatus === 'adequate' && unchecked > 0 && (
        <div className="alert alert-warning mt-16"><AlertTriangle size={16} /> {unchecked} item(s) are unticked but the result is “Adequate”. Double-check before saving.</div>
      )}
      {finalStatus !== 'adequate' && <div className="alert alert-info mt-16"><CheckCircle2 size={16} /> After saving, restock or replace items from the kit page — inspection results don’t change stock.</div>}
    </div>
  );
};

export default KitInspection;
