import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBox, createInspection } from '../services/api';
import { CheckSquare, ArrowLeft, Save, ShieldAlert, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import './Treatments.css'; // Reuse form styles

const InspectionForm = () => {
  const { boxId } = useParams();
  const navigate = useNavigate();
  const [box, setBox] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    inspectionDate: new Date().toISOString().split('T')[0],
    status: 'adequate',
    overallNotes: '',
    checklist: [
      { itemName: 'Box is clean and dry', checked: false, notes: '' },
      { itemName: 'Box is clearly marked and accessible', checked: false, notes: '' },
      { itemName: 'Emergency contact numbers visible', checked: false, notes: '' },
      { itemName: 'No expired items present', checked: false, notes: '' }
    ],
    deficiencies: []
  });

  useEffect(() => {
    getBox(boxId)
      .then(res => setBox(res.data.data))
      .catch(() => navigate('/inventory'))
      .finally(() => setLoading(false));
  }, [boxId]);

  const toggleChecklist = (i) => {
    setForm(prev => {
      const list = [...prev.checklist];
      list[i].checked = !list[i].checked;
      return { ...prev, checklist: list };
    });
  };

  const addDeficiency = () => {
    setForm(prev => ({
      ...prev,
      deficiencies: [...prev.deficiencies, { description: '', severity: 'minor' }]
    }));
  };

  const updateDeficiency = (i, field, value) => {
    setForm(prev => {
      const defs = [...prev.deficiencies];
      defs[i] = { ...defs[i], [field]: value };
      return { ...prev, deficiencies: defs };
    });
  };

  const removeDeficiency = (i) => {
    setForm(prev => ({
      ...prev,
      deficiencies: prev.deficiencies.filter((_, idx) => idx !== i)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        firstAidBox: boxId,
        inspectionDate: form.inspectionDate,
        status: form.status,
        overallNotes: form.overallNotes,
        checklist: form.checklist,
        deficiencies: form.deficiencies.filter(d => d.description.trim())
      };
      await createInspection(payload);
      toast.success('Inspection recorded successfully');
      navigate(`/inventory/boxes/scan/${box.boxId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit inspection');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;
  if (!box) return null;

  return (
    <div className="page-content">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">Run Inspection</h1>
            <p className="page-subtitle">Box: {box.boxId} ({box.location})</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}><CheckSquare size={18} /> Basic Checklist</h3>
          <div className="treatment-form-grid" style={{ gridTemplateColumns: '1fr' }}>
            {form.checklist.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <input type="checkbox" checked={item.checked} onChange={() => toggleChecklist(i)} style={{ width: 18, height: 18, accentColor: 'var(--blue-600)' }} />
                <span style={{ flex: 1, fontSize: '0.95rem', color: 'var(--text-main)' }}>{item.itemName}</span>
                <input type="text" placeholder="Notes (optional)" value={item.notes} onChange={e => {
                  const list = [...form.checklist]; list[i].notes = e.target.value;
                  setForm({ ...form, checklist: list });
                }} style={{ width: 250 }} />
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3 className="card-title"><ShieldAlert size={18} /> Deficiencies Found</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addDeficiency}><Plus size={16} />Add Deficiency</button>
          </div>
          {form.deficiencies.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No deficiencies noted. Box is compliant.</p>
          ) : (
            <div className="treatment-form-grid" style={{ gridTemplateColumns: '1fr' }}>
              {form.deficiencies.map((def, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <input style={{ flex: 1 }} placeholder="Describe deficiency..." value={def.description} onChange={e => updateDeficiency(i, 'description', e.target.value)} required />
                  <select style={{ width: 150 }} value={def.severity} onChange={e => updateDeficiency(i, 'severity', e.target.value)}>
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="serious">Serious</option>
                    <option value="critical">Critical</option>
                  </select>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeDeficiency(i)} style={{ color: 'var(--red-600)' }}><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>Conclusion</h3>
          <div className="treatment-form-grid">
            <div className="form-group">
              <label className="form-label">Inspection Date *</label>
              <input type="date" value={form.inspectionDate} onChange={e => setForm({ ...form, inspectionDate: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Result Status *</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} required>
                <option value="adequate">Adequate / Compliant</option>
                <option value="needs_replenishment">Needs Replenishment</option>
                <option value="items_expired">Items Expired</option>
                <option value="failed">Failed / Unsafe</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label className="form-label">Overall Notes</label>
              <textarea rows={3} value={form.overallNotes} onChange={e => setForm({ ...form, overallNotes: e.target.value })} placeholder="Any additional comments..." />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={18} />{saving ? 'Saving...' : 'Submit Inspection'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InspectionForm;
