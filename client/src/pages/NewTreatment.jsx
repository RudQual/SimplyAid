import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createTreatment, getUsers, getIncidents, getBoxes, getInventoryItems } from '../services/api';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import './Treatments.css';

const NewTreatment = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  const [form, setForm] = useState({
    employee: '', treatmentDate: new Date().toISOString().split('T')[0],
    treatmentTime: new Date().toTimeString().slice(0, 5), treatmentLocation: '',
    injuryType: '', injurySeverity: 'minor', treatmentProvided: '',
    incident: '', firstAidBoxUsed: '', remarks: '',
    medicinesUsed: []
  });

  useEffect(() => {
    Promise.all([
      getUsers().catch(() => ({ data: { data: [] } })),
      getIncidents({ limit: 50 }).catch(() => ({ data: { data: [] } })),
      getBoxes().catch(() => ({ data: { data: [] } })),
      getInventoryItems().catch(() => ({ data: { data: [] } }))
    ]).then(([empRes, incRes, boxRes, itemRes]) => {
      setEmployees(empRes.data.data || []);
      setIncidents(incRes.data.data || []);
      setBoxes(boxRes.data.data || []);
      setInventoryItems(itemRes.data.data || []);
    });
  }, []);

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const addMedicine = () => {
    setForm(prev => ({
      ...prev,
      medicinesUsed: [...prev.medicinesUsed, { item: '', name: '', quantity: 1 }]
    }));
  };

  const updateMedicine = (index, field, value) => {
    setForm(prev => {
      const meds = [...prev.medicinesUsed];
      meds[index] = { ...meds[index], [field]: value };
      if (field === 'item' && value) {
        const item = inventoryItems.find(i => i._id === value);
        if (item) meds[index].name = item.name;
      }
      return { ...prev, medicinesUsed: meds };
    });
  };

  const removeMedicine = (index) => {
    setForm(prev => ({ ...prev, medicinesUsed: prev.medicinesUsed.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee || !form.treatmentProvided) {
      toast.error('Please fill in required fields');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form };
      if (!payload.incident) delete payload.incident;
      if (!payload.firstAidBoxUsed) delete payload.firstAidBoxUsed;
      payload.medicinesUsed = payload.medicinesUsed.filter(m => m.name);
      await createTreatment(payload);
      toast.success('Treatment record created successfully');
      navigate('/treatments');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create treatment');
    } finally { setSaving(false); }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">New Treatment Record</h1>
            <p className="page-subtitle">Record first aid treatment provided to an employee</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="card-title" style={{ marginBottom: 20 }}>Patient & Incident</h3>
          <div className="treatment-form-grid">
            <div className="form-group">
              <label className="form-label">Employee *</label>
              <select value={form.employee} onChange={e => updateForm('employee', e.target.value)} required>
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.name} ({emp.employeeId || emp.email})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Linked Incident</label>
              <select value={form.incident} onChange={e => updateForm('incident', e.target.value)}>
                <option value="">None</option>
                {incidents.map(inc => (
                  <option key={inc._id} value={inc._id}>{inc.incidentId} — {inc.description?.substring(0, 40)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Treatment Date *</label>
              <input type="date" value={form.treatmentDate} onChange={e => updateForm('treatmentDate', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Treatment Time</label>
              <input type="time" value={form.treatmentTime} onChange={e => updateForm('treatmentTime', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="card-title" style={{ marginBottom: 20 }}>Injury & Treatment Details</h3>
          <div className="treatment-form-grid">
            <div className="form-group">
              <label className="form-label">Injury Type</label>
              <input type="text" value={form.injuryType} onChange={e => updateForm('injuryType', e.target.value)} placeholder="e.g. Cut, Burn, Sprain" />
            </div>
            <div className="form-group">
              <label className="form-label">Injury Severity *</label>
              <select value={form.injurySeverity} onChange={e => updateForm('injurySeverity', e.target.value)} required>
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="serious">Serious</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Treatment Location</label>
              <input type="text" value={form.treatmentLocation} onChange={e => updateForm('treatmentLocation', e.target.value)} placeholder="e.g. First Aid Room, Workshop" />
            </div>
            <div className="form-group">
              <label className="form-label">First Aid Box Used</label>
              <select value={form.firstAidBoxUsed} onChange={e => updateForm('firstAidBoxUsed', e.target.value)}>
                <option value="">None</option>
                {boxes.map(box => (
                  <option key={box._id} value={box._id}>{box.boxId} — {box.location}</option>
                ))}
              </select>
            </div>
            <div className="form-group full-width">
              <label className="form-label">Treatment Provided *</label>
              <textarea rows={3} value={form.treatmentProvided} onChange={e => updateForm('treatmentProvided', e.target.value)} placeholder="Describe the treatment given..." required />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3 className="card-title">Medicines Used</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addMedicine}><Plus size={16} />Add Medicine</button>
          </div>
          {form.medicinesUsed.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No medicines added yet. Click "Add Medicine" to record items used.</p>
          ) : (
            form.medicinesUsed.map((med, i) => (
              <div key={i} className="medicine-row">
                <select value={med.item} onChange={e => updateMedicine(i, 'item', e.target.value)}>
                  <option value="">Select item or type name</option>
                  {inventoryItems.map(item => (
                    <option key={item._id} value={item._id}>{item.name} ({item.category})</option>
                  ))}
                </select>
                <input type="number" min="1" value={med.quantity} onChange={e => updateMedicine(i, 'quantity', parseInt(e.target.value) || 1)} placeholder="Qty" />
                <button type="button" className="remove-btn" onClick={() => removeMedicine(i)}><Trash2 size={16} /></button>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="form-group">
            <label className="form-label">Remarks</label>
            <textarea rows={2} value={form.remarks} onChange={e => updateForm('remarks', e.target.value)} placeholder="Additional notes..." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={18} />{saving ? 'Saving...' : 'Save Treatment'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default NewTreatment;
