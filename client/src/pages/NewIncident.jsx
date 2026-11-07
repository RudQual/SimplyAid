
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useScanner } from '../contexts/ScannerContext';
import { createIncident, getDepartments, getBoxes, getInventoryItems } from '../services/api';
import { ArrowLeft, ArrowRight, Save, AlertTriangle, MapPin, Radio, Stethoscope, Briefcase, Clock, Plus, X, Box } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = ['report.step1', 'report.step2', 'report.step3', 'report.step4'];

const BODY_PARTS = ['Head', 'Face', 'Eye', 'Neck', 'Shoulder', 'Arm', 'Hand', 'Finger', 'Chest', 'Back', 'Abdomen', 'Hip', 'Leg', 'Knee', 'Foot', 'Toe', 'Multiple'];

const INJURY_TYPES = [
  'Cut / Laceration',
  'Burn',
  'Fracture',
  'Sprain / Strain',
  'Chemical Exposure',
  'Electric Shock',
  'Eye Injury',
  'Crush Injury',
  'Abrasion',
  'Puncture Wound',
  'Dislocation',
  'Concussion',
  'Amputation',
  'Hearing Loss',
  'Respiratory Issue'
];

const NewIncident = () => {
  const { t, user } = useAuth();
  const { selectedScanner } = useScanner();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    injuredPerson: { name: '', employeeId: '', department: '', age: '', gender: 'male', designation: '' },
    dateTime: new Date().toISOString().slice(0, 16),
    location: '',
    department: '',
    severity: 'minor',
    description: '',
    causeOfInjury: '',
    bodyPartAffected: [],
    injuryTypes: [],
    outcome: '',
    hospitalName: '',
    daysLost: 0,
    witnesses: '',
    usedFirstAid: false,
    firstAidBoxUsed: '',
    itemsUsed: []
  });

  const [boxes, setBoxes] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [itemQty, setItemQty] = useState(1);

  // Auto-fill from scanner
  useEffect(() => {
    if (selectedScanner) {
      setForm(f => ({
        ...f,
        location: selectedScanner.location || '',
        department: selectedScanner.department?._id || selectedScanner.department || f.department
      }));
    }
  }, [selectedScanner]);

  useEffect(() => {
    getDepartments().then(d => setDepartments(d.data.data)).catch(console.error);
    getBoxes().then(b => setBoxes(b.data.data)).catch(console.error);
    getInventoryItems().then(i => setInventoryItems(i.data.data)).catch(console.error);
  }, []);

  // Autofill for presentation
  useEffect(() => {
    const handleAutofill = () => {
      const defaultDept = departments.length > 0 ? departments[0]._id : '';
      const scenarios = [
        {
          injuredPerson: { name: 'Rajesh Kumar', employeeId: 'EMP-9021', department: defaultDept, age: '34', gender: 'male', designation: 'Machine Operator' },
          location: 'Assembly Line C, Sector 4',
          severity: 'serious',
          description: 'While performing routine maintenance, Rajesh slipped on an unmarked oil spill near conveyor belt #3. He landed heavily on his right arm, sustaining a deep laceration and a suspected fracture.',
          causeOfInjury: 'Slip and Fall due to unmarked oil spill',
          bodyPartAffected: ['Arm', 'Hand'],
          injuryTypes: [{ type: 'Fracture', severity: 'serious' }, { type: 'Cut / Laceration', severity: 'serious' }],
          outcome: 'referred_to_doctor',
          hospitalName: 'City Care Hospital',
          daysLost: 14,
          witnesses: 'Amit Patel (EMP-4051), Sunita Sharma (EMP-1120)'
        },
        {
          injuredPerson: { name: 'Priya Singh', employeeId: 'EMP-7732', department: defaultDept, age: '28', gender: 'female', designation: 'Quality Inspector' },
          location: 'Packaging Area B',
          severity: 'minor',
          description: 'Priya caught her index finger in the packaging sealing machine, causing a minor cut and bruising. The machine was immediately stopped.',
          causeOfInjury: 'Machine pinch point',
          bodyPartAffected: ['Finger'],
          injuryTypes: [{ type: 'Cut / Laceration', severity: 'minor' }, { type: 'Crush Injury', severity: 'minor' }],
          outcome: 'returned_to_work',
          hospitalName: '',
          daysLost: 0,
          witnesses: 'Vikram Das (EMP-2134)'
        },
        {
          injuredPerson: { name: 'Anil Desai', employeeId: 'EMP-5510', department: defaultDept, age: '45', gender: 'male', designation: 'Chemical Handler' },
          location: 'Chemical Storage Facility',
          severity: 'moderate',
          description: 'Anil accidentally splashed cleaning solvent on his face and eyes while transferring liquids. He was wearing standard PPE but the splash bypassed the goggles.',
          causeOfInjury: 'Chemical splash',
          bodyPartAffected: ['Face', 'Eye'],
          injuryTypes: [{ type: 'Chemical Exposure', severity: 'moderate' }, { type: 'Eye Injury', severity: 'moderate' }],
          outcome: 'pending_confirmation',
          hospitalName: '',
          daysLost: 0,
          witnesses: 'Suresh Verma (EMP-8822)'
        },
        {
          injuredPerson: { name: 'Meera Reddy', employeeId: 'EMP-3204', department: defaultDept, age: '31', gender: 'female', designation: 'Warehouse Associate' },
          location: 'Loading Dock 2',
          severity: 'moderate',
          description: 'A stack of small boxes fell from a pallet while Meera was unloading. One box struck her shoulder, causing a sprain.',
          causeOfInjury: 'Falling object',
          bodyPartAffected: ['Shoulder'],
          injuryTypes: [{ type: 'Sprain / Strain', severity: 'moderate' }],
          outcome: 'referred_to_doctor',
          hospitalName: 'Apex Medical Center',
          daysLost: 3,
          witnesses: 'John Smith (EMP-1102)'
        }
      ];

      const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];

      setForm(f => ({
        ...f,
        ...randomScenario,
        dateTime: new Date().toISOString().slice(0,16),
        department: defaultDept
      }));
      toast.success('Form magically autofilled! ✨');
    };

    window.addEventListener('autofill-incident', handleAutofill);
    return () => window.removeEventListener('autofill-incident', handleAutofill);
  }, [departments]);


  const set = (path, val) => {
    setForm(f => {
      const copy = { ...f };
      if (path.includes('.')) { const [a, b] = path.split('.'); copy[a] = { ...copy[a], [b]: val }; }
      else copy[path] = val;
      return copy;
    });
  };

  const toggleBodyPart = (part) => {
    setForm(f => ({ ...f, bodyPartAffected: f.bodyPartAffected.includes(part) ? f.bodyPartAffected.filter(p => p !== part) : [...f.bodyPartAffected, part] }));
  };

  const addItem = () => {
    if (!selectedItem || itemQty < 1) return;
    const itemObj = inventoryItems.find(i => i._id === selectedItem);
    setForm(f => ({
      ...f,
      itemsUsed: [...f.itemsUsed, { item: selectedItem, itemName: itemObj.name, quantity: parseInt(itemQty) }]
    }));
    setSelectedItem(''); setItemQty(1);
  };

  const removeItem = (idx) => {
    setForm(f => {
      const copy = [...f.itemsUsed];
      copy.splice(idx, 1);
      return { ...f, itemsUsed: copy };
    });
  };

  const toggleInjuryType = (type) => {
    setForm(f => {
      const exists = f.injuryTypes.find(it => it.type === type);
      if (exists) {
        return { ...f, injuryTypes: f.injuryTypes.filter(it => it.type !== type) };
      } else {
        return { ...f, injuryTypes: [...f.injuryTypes, { type, severity: f.severity }] };
      }
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const data = {
        ...form,
        witnesses: form.witnesses ? form.witnesses.split(',').map(w => w.trim()) : [],
        daysLost: parseInt(form.daysLost) || 0,
        injuredPerson: { ...form.injuredPerson, age: parseInt(form.injuredPerson.age) || undefined },
        incidentType: 'injury', // Default since we now use injuryTypes[]
        scanner: selectedScanner?._id || undefined
      };
      // Remove empty fields
      if (!data.hospitalName) delete data.hospitalName;
      if (!data.usedFirstAid) {
        delete data.firstAidBoxUsed;
        data.itemsUsed = [];
      } else if (!data.firstAidBoxUsed) {
        delete data.firstAidBoxUsed; // in case it was toggled but no box selected
      }
      delete data.usedFirstAid; // not needed in schema

      const res = await createIncident(data);
      toast.success(t('report.success') + (res.data.data?.incidentId ? ` · ${res.data.data.incidentId}` : ''));
      if (res.data.warning) toast(res.data.warning, { icon: '⚠️', duration: 7000 });
      navigate(`/incidents/${res.data.data._id}`);
    } catch (err) { toast.error(err.response?.data?.message || t('report.failed')); }
    finally { setLoading(false); }
  };

  const canNext = () => {
    if (step === 0) return form.injuredPerson.name && form.injuredPerson.department;
    if (step === 1) return form.description && (form.location || selectedScanner);
    if (step === 2) {
      if (form.usedFirstAid && !form.firstAidBoxUsed) return false;
      return true;
    }
    return form.outcome;
  };

  const scannerLocation = selectedScanner?.location;
  const scannerName = selectedScanner?.name;

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">{t('incidents.new')}</h1><p className="page-subtitle">{t('report.subtitle')}</p></div>
        <button className="btn btn-ghost" onClick={() => navigate('/incidents')}><ArrowLeft size={18} />{t('common.back')}</button>
      </div>

      {/* Scanner info bar */}
      {selectedScanner ? (
        <div style={{ marginBottom: 16, padding: '12px 18px', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem' }}>
          <Radio size={16} color="var(--blue-600)" />
          <span style={{ fontWeight: 600, color: 'var(--blue-600)' }}>{t('report.location')}</span>
          <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{scannerName}</span>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <MapPin size={14} color="var(--text-muted)" />
          <span style={{ color: 'var(--text-secondary)' }}>{scannerLocation}</span>
        </div>
      ) : (
        <div style={{ marginBottom: 16, padding: '12px 18px', background: 'var(--warning-50)', border: '1px dashed var(--warning-100)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', color: 'var(--warning-700)' }}>
          <AlertTriangle size={16} />
          <span style={{ fontWeight: 600 }}>{t('report.noLocation')}</span>
          <span style={{ fontWeight: 400 }}>{t('report.noLocationHint')}</span>
        </div>
      )}

      {/* Step indicator */}
      <div className="card" style={{ marginBottom: 24, padding: '16px 24px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700,
                background: i <= step ? 'var(--blue-600)' : 'var(--bg-app)', color: i <= step ? '#fff' : 'var(--text-muted)', flexShrink: 0, border: i <= step ? 'none' : '1px solid var(--border-color)'
              }}>{i + 1}</div>
              <span style={{ fontSize: '0.82rem', fontWeight: i === step ? 600 : 400, color: i === step ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t(s)}</span>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? 'var(--blue-600)' : 'var(--border-color)', borderRadius: 2 }}></div>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        {/* Step 0: Injured Person */}
        {step === 0 && (
          <div>
            <h3 className="card-title" style={{ marginBottom: 20 }}>{t('report.personTitle')}</h3>
            <div className="form-row">
              <div className="form-group"><label className="form-label">{t('report.fullName')} *</label><input value={form.injuredPerson.name} onChange={e => set('injuredPerson.name', e.target.value)} placeholder={t('report.enterName')} /></div>
              <div className="form-group"><label className="form-label">{t('report.employeeId')}</label><input value={form.injuredPerson.employeeId} onChange={e => set('injuredPerson.employeeId', e.target.value)} placeholder="EMP001" /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label className="form-label">{t('report.department')} *</label><select value={form.injuredPerson.department} onChange={e => set('injuredPerson.department', e.target.value)}><option value="">{t('report.select')}</option>{departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
              <div className="form-group"><label className="form-label">{t('report.age')}</label><input type="number" value={form.injuredPerson.age} onChange={e => set('injuredPerson.age', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">{t('report.gender')}</label><select value={form.injuredPerson.gender} onChange={e => set('injuredPerson.gender', e.target.value)}><option value="male">{t('report.male')}</option><option value="female">{t('report.female')}</option><option value="other">{t('report.other')}</option></select></div>
            </div>
            <div className="form-group"><label className="form-label">{t('report.designation')}</label><input value={form.injuredPerson.designation} onChange={e => set('injuredPerson.designation', e.target.value)} /></div>
          </div>
        )}

        {/* Step 1: Incident Details */}
        {step === 1 && (
          <div>
            <h3 className="card-title" style={{ marginBottom: 20 }}>{t('report.detailsTitle')}</h3>
            <div className="form-row">
              <div className="form-group"><label className="form-label">{t('incidents.dateTime')} *</label><input type="datetime-local" value={form.dateTime} onChange={e => set('dateTime', e.target.value)} /></div>
              <div className="form-group">
                <label className="form-label">{t('incidents.location')} {selectedScanner ? t('report.fromScanner') : '*'}</label>
                {selectedScanner ? (
                  <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={14} color="var(--blue-600)" />
                    {selectedScanner.location}
                  </div>
                ) : (
                  <input value={form.location} onChange={e => set('location', e.target.value)} placeholder={t('report.where')} />
                )}
              </div>
            </div>

            <div className="form-group"><label className="form-label">{t('incidents.severity')}</label>
              <div style={{ display: 'flex', gap: 8 }}>{['minor', 'moderate', 'serious', 'fatal'].map(s => (
                <button key={s} type="button" className={`btn btn-sm ${form.severity === s ? `btn-${s === 'minor' ? 'success' : s === 'moderate' ? 'warning' : 'danger'}` : 'btn-ghost'}`} onClick={() => set('severity', s)} style={{ textTransform: 'capitalize' }}>{t(`incidents.${s}`)}</button>
              ))}</div>
            </div>

            <div className="form-group"><label className="form-label">{t('incidents.description')} *</label><textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder={t('report.whatHappened')} /></div>
            <div className="form-group"><label className="form-label">{t('report.cause')}</label><input value={form.causeOfInjury} onChange={e => set('causeOfInjury', e.target.value)} /></div>

            {/* Multiple Injury Types */}
            <div className="form-group">
              <label className="form-label">{t('report.injuryTypes')} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.78rem' }}>{t('report.selectAll')}</span></label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {INJURY_TYPES.map(type => {
                  const selected = form.injuryTypes.some(it => it.type === type);
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => toggleInjuryType(type)}
                      style={{ fontSize: '0.8rem' }}
                    >
                      {t(`injuryTypes.${type}`, null, type)}
                    </button>
                  );
                })}
              </div>
              {form.injuryTypes.length > 0 && (
                <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {t('report.selected')} {form.injuryTypes.map(it => t(`injuryTypes.${it.type}`, null, it.type)).join(', ')}
                </div>
              )}
            </div>

            <div className="form-group"><label className="form-label">{t('report.bodyParts')}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{BODY_PARTS.map(p => (
                <button key={p} type="button" className={`btn btn-sm ${form.bodyPartAffected.includes(p) ? 'btn-primary' : 'btn-ghost'}`} onClick={() => toggleBodyPart(p)}>{t(`bodyParts.${p}`, null, p)}</button>
              ))}</div>
            </div>

            <div className="form-group"><label className="form-label">{t('report.witnesses')}</label><input value={form.witnesses} onChange={e => set('witnesses', e.target.value)} placeholder="Name 1, Name 2" /></div>
          </div>
        )}

        {/* Step 2: First Aid / Medicine */}
        {step === 2 && (
          <div>
            <h3 className="card-title" style={{ marginBottom: 20 }}>{t('report.firstAidTitle')}</h3>
            <p style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {t('report.firstAidQ')}
            </p>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 16px', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                <input type="checkbox" checked={form.usedFirstAid} onChange={e => set('usedFirstAid', e.target.checked)} style={{ width: 18, height: 18 }} />
                <span style={{ fontWeight: 600 }}>{t('report.usedKit')}</span>
              </label>
            </div>

            {form.usedFirstAid && (
              <div style={{ marginTop: 24, padding: 20, border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-app)' }}>
                <div className="form-group">
                  <label className="form-label">{t('report.selectKit')} *</label>
                  <select value={form.firstAidBoxUsed} onChange={e => set('firstAidBoxUsed', e.target.value)}>
                    <option value="">{t('report.chooseKit')}</option>
                    {boxes.map(b => <option key={b._id} value={b._id}>{b.boxId} ({b.location})</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ marginTop: 20 }}>
                  <label className="form-label">{t('report.itemsUsed')}</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <select style={{ flex: 1 }} value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
                      <option value="">{t('report.chooseItem')}</option>
                      {(() => { const box = boxes.find(b => b._id === form.firstAidBoxUsed); const inBox = box ? new Map(box.items.map(bi => [bi.item?._id || bi.item, bi.currentQty])) : null; return inventoryItems.filter(i => !inBox || inBox.has(i._id)).map(i => <option key={i._id} value={i._id}>{i.name} ({inBox ? inBox.get(i._id) + ' ' : ''}{i.unit}{inBox ? ` ${t('report.inKit')}` : ''})</option>); })()}
                    </select>
                    <input type="number" min="1" value={itemQty} onChange={e => setItemQty(e.target.value)} style={{ width: 80 }} placeholder={t('report.qty')} />
                    <button type="button" className="btn btn-primary" onClick={addItem} disabled={!selectedItem || itemQty < 1}><Plus size={16} /> {t('report.add')}</button>
                  </div>
                </div>

                {form.itemsUsed.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{t('report.added')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {form.itemsUsed.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Box size={16} color="var(--text-muted)" />
                            <span style={{ fontWeight: 500 }}>{item.itemName}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>x {item.quantity}</span>
                          </div>
                          <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--red-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Outcome — simplified to 2 options */}
        {step === 3 && (
          <div>
            <h3 className="card-title" style={{ marginBottom: 20 }}>{t('report.outcomeTitle')}</h3>
            <p style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {t('report.outcomeQ')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Option 1: Send to Doctor */}
              <button
                type="button"
                onClick={() => set('outcome', 'referred_to_doctor')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px',
                  background: form.outcome === 'referred_to_doctor' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-app)',
                  border: `2px solid ${form.outcome === 'referred_to_doctor' ? 'var(--blue-600)' : 'var(--border-color)'}`,
                  borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: form.outcome === 'referred_to_doctor' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.06)',
                  color: 'var(--blue-600)'
                }}>
                  <Stethoscope size={26} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', marginBottom: 4 }}>{t('report.doctor')}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {t('report.doctorText')}
                  </div>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', border: `2px solid ${form.outcome === 'referred_to_doctor' ? 'var(--blue-600)' : 'var(--border-color)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {form.outcome === 'referred_to_doctor' && <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--blue-600)' }} />}
                </div>
              </button>

              {/* Option 2: Back to Work */}
              <button
                type="button"
                onClick={() => set('outcome', 'returned_to_work')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px',
                  background: form.outcome === 'returned_to_work' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-app)',
                  border: `2px solid ${form.outcome === 'returned_to_work' ? '#10B981' : 'var(--border-color)'}`,
                  borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: form.outcome === 'returned_to_work' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.06)',
                  color: '#10B981'
                }}>
                  <Briefcase size={26} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', marginBottom: 4 }}>{t('report.work')}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {t('report.workText')}
                  </div>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', border: `2px solid ${form.outcome === 'returned_to_work' ? '#10B981' : 'var(--border-color)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {form.outcome === 'returned_to_work' && <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10B981' }} />}
                </div>
              </button>

              {/* Option 3: Pending Manager Confirmation */}
              <button
                type="button"
                onClick={() => set('outcome', 'pending_confirmation')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px',
                  background: form.outcome === 'pending_confirmation' ? 'rgba(249, 115, 22, 0.08)' : 'var(--bg-app)',
                  border: `2px solid ${form.outcome === 'pending_confirmation' ? '#F97316' : 'var(--border-color)'}`,
                  borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: form.outcome === 'pending_confirmation' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.06)',
                  color: '#F97316'
                }}>
                  <Clock size={26} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', marginBottom: 4 }}>{t('report.manager')}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {t('report.managerText')}
                  </div>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', border: `2px solid ${form.outcome === 'pending_confirmation' ? '#F97316' : 'var(--border-color)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {form.outcome === 'pending_confirmation' && <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F97316' }} />}
                </div>
              </button>
            </div>

            {form.outcome === 'pending_confirmation' && (
              <div style={{ marginTop: 16, padding: 14, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <Clock size={16} color="#F97316" />
                <span>{t('report.managerNote')}</span>
              </div>
            )}

            {form.outcome === 'referred_to_doctor' && (
              <div style={{ marginTop: 16, padding: 14, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <Stethoscope size={16} color="var(--blue-600)" />
                <span>{t('report.doctorNote')}</span>
              </div>
            )}

            {(parseInt(form.daysLost) >= 2 || form.severity === 'fatal') && (
              <div style={{ padding: 16, background: 'var(--red-50)', border: '1px solid var(--red-600)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
                <AlertTriangle size={20} color="var(--red-600)" />
                <div><div style={{ fontWeight: 600, color: 'var(--red-600)', fontSize: '0.9rem' }}>{t('report.reportable')}</div><div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('report.reportableText')}</div></div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
          <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)} disabled={step === 0}><ArrowLeft size={16} /> {t('common.back')}</button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>{t('common.next')} <ArrowRight size={16} /></button>
          ) : (
            <button className="btn btn-success" onClick={handleSubmit} disabled={loading || !canNext()}><Save size={16} /> {loading ? t('common.loading') : t('common.submit')}</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewIncident;
