import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useScanner } from '../contexts/ScannerContext';
import { createIncident, getDepartments, getUsers } from '../services/api';
import { ArrowLeft, ArrowRight, Save, AlertTriangle, MapPin, Radio, Stethoscope, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = ['Injured Person', 'Incident Details', 'Outcome'];

const BODY_PARTS = ['Head','Face','Eye','Neck','Shoulder','Arm','Hand','Finger','Chest','Back','Abdomen','Hip','Leg','Knee','Foot','Toe','Multiple'];

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
    dateTime: new Date().toISOString().slice(0,16),
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
    witnesses: ''
  });

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
    getDepartments().then(d => {
      setDepartments(d.data.data);
    }).catch(console.error);
  }, []);

  const set = (path, val) => {
    setForm(f => {
      const copy = { ...f };
      if (path.includes('.')) { const [a,b] = path.split('.'); copy[a] = { ...copy[a], [b]: val }; }
      else copy[path] = val;
      return copy;
    });
  };

  const toggleBodyPart = (part) => {
    setForm(f => ({ ...f, bodyPartAffected: f.bodyPartAffected.includes(part) ? f.bodyPartAffected.filter(p => p !== part) : [...f.bodyPartAffected, part] }));
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
      
      await createIncident(data);
      toast.success('Incident reported successfully!');
      navigate('/incidents');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to report incident'); }
    finally { setLoading(false); }
  };

  const canNext = () => {
    if (step === 0) return form.injuredPerson.name && form.injuredPerson.department;
    if (step === 1) return form.description && (form.location || selectedScanner);
    return form.outcome;
  };

  const scannerLocation = selectedScanner?.location;
  const scannerName = selectedScanner?.name;

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">{t('incidents.new')}</h1><p className="page-subtitle">Report a new workplace incident</p></div>
        <button className="btn btn-ghost" onClick={() => navigate('/incidents')}><ArrowLeft size={18} />{t('common.back')}</button>
      </div>

      {/* Scanner info bar */}
      {selectedScanner ? (
        <div style={{marginBottom:16,padding:'12px 18px',background:'rgba(99, 102, 241, 0.06)',border:'1.5px solid rgba(99, 102, 241, 0.2)',borderRadius:10,display:'flex',alignItems:'center',gap:10,fontSize:'0.88rem'}}>
          <Radio size={16} color="var(--blue-600)" />
          <span style={{fontWeight:600,color:'var(--blue-600)'}}>Scanner:</span>
          <span style={{color:'var(--text-main)',fontWeight:500}}>{scannerName}</span>
          <span style={{color:'var(--text-muted)'}}>·</span>
          <MapPin size={14} color="var(--text-muted)" />
          <span style={{color:'var(--text-secondary)'}}>{scannerLocation}</span>
        </div>
      ) : (
        <div style={{marginBottom:16,padding:'12px 18px',background:'rgba(245, 158, 11, 0.08)',border:'1.5px dashed rgba(245, 158, 11, 0.3)',borderRadius:10,display:'flex',alignItems:'center',gap:10,fontSize:'0.88rem',color:'#f59e0b'}}>
          <AlertTriangle size={16} />
          <span style={{fontWeight:600}}>No scanner selected.</span>
          <span style={{fontWeight:400}}>Select a scanner from the top bar to auto-fill location.</span>
        </div>
      )}

      {/* Step indicator */}
      <div className="card" style={{marginBottom:24,padding:'16px 24px'}}>
        <div style={{display:'flex',gap:8}}>
          {STEPS.map((s,i) => (
            <div key={i} style={{flex:1,display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',fontWeight:700,
                background: i <= step ? 'var(--blue-600)' : 'var(--bg-app)', color: i <= step ? '#fff' : 'var(--text-muted)', flexShrink:0, border: i <= step ? 'none' : '1px solid var(--border-color)'}}>{i+1}</div>
              <span style={{fontSize:'0.82rem',fontWeight:i===step?600:400,color:i===step?'var(--text-main)':'var(--text-muted)',whiteSpace:'nowrap'}}>{s}</span>
              {i < STEPS.length-1 && <div style={{flex:1,height:2,background:i<step?'var(--blue-600)':'var(--border-color)',borderRadius:2}}></div>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        {/* Step 0: Injured Person */}
        {step === 0 && (
          <div>
            <h3 style={{marginBottom:20,fontWeight:700}}>Injured Person Details</h3>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Full Name *</label><input value={form.injuredPerson.name} onChange={e => set('injuredPerson.name', e.target.value)} placeholder="Enter name" /></div>
              <div className="form-group"><label className="form-label">Employee ID</label><input value={form.injuredPerson.employeeId} onChange={e => set('injuredPerson.employeeId', e.target.value)} placeholder="EMP001" /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label className="form-label">Department *</label><select value={form.injuredPerson.department} onChange={e => set('injuredPerson.department', e.target.value)}><option value="">Select</option>{departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Age</label><input type="number" value={form.injuredPerson.age} onChange={e => set('injuredPerson.age', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Gender</label><select value={form.injuredPerson.gender} onChange={e => set('injuredPerson.gender', e.target.value)}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
            </div>
            <div className="form-group"><label className="form-label">Designation</label><input value={form.injuredPerson.designation} onChange={e => set('injuredPerson.designation', e.target.value)} /></div>
          </div>
        )}

        {/* Step 1: Incident Details */}
        {step === 1 && (
          <div>
            <h3 style={{marginBottom:20,fontWeight:700}}>Incident Details</h3>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Date & Time *</label><input type="datetime-local" value={form.dateTime} onChange={e => set('dateTime', e.target.value)} /></div>
              <div className="form-group">
                <label className="form-label">Location {selectedScanner ? '(from scanner)' : '*'}</label>
                {selectedScanner ? (
                  <div style={{padding:'10px 14px',background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:8,fontSize:'0.9rem',color:'var(--text-main)',display:'flex',alignItems:'center',gap:8}}>
                    <MapPin size={14} color="var(--blue-600)" />
                    {selectedScanner.location}
                  </div>
                ) : (
                  <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Where did it happen?" />
                )}
              </div>
            </div>

            <div className="form-group"><label className="form-label">Severity</label>
              <div style={{display:'flex',gap:8}}>{['minor','moderate','serious','fatal'].map(s => (
                <button key={s} type="button" className={`btn btn-sm ${form.severity===s ? `btn-${s==='minor'?'success':s==='moderate'?'warning':'danger'}` : 'btn-ghost'}`} onClick={() => set('severity',s)} style={{textTransform:'capitalize'}}>{t(`incidents.${s}`)}</button>
              ))}</div>
            </div>

            <div className="form-group"><label className="form-label">Description *</label><textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe what happened..." /></div>
            <div className="form-group"><label className="form-label">Cause of Injury</label><input value={form.causeOfInjury} onChange={e => set('causeOfInjury', e.target.value)} /></div>

            {/* Multiple Injury Types */}
            <div className="form-group">
              <label className="form-label">Injury Types <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:'0.78rem'}}>(select all that apply)</span></label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {INJURY_TYPES.map(type => {
                  const selected = form.injuryTypes.some(it => it.type === type);
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => toggleInjuryType(type)}
                      style={{fontSize:'0.8rem'}}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
              {form.injuryTypes.length > 0 && (
                <div style={{marginTop:8,fontSize:'0.8rem',color:'var(--text-secondary)'}}>
                  Selected: {form.injuryTypes.map(it => it.type).join(', ')}
                </div>
              )}
            </div>

            <div className="form-group"><label className="form-label">Body Parts Affected</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{BODY_PARTS.map(p => (
                <button key={p} type="button" className={`btn btn-sm ${form.bodyPartAffected.includes(p) ? 'btn-primary' : 'btn-ghost'}`} onClick={() => toggleBodyPart(p)}>{p}</button>
              ))}</div>
            </div>

            <div className="form-group"><label className="form-label">Witnesses (comma separated)</label><input value={form.witnesses} onChange={e => set('witnesses', e.target.value)} placeholder="Name 1, Name 2" /></div>
          </div>
        )}

        {/* Step 2: Outcome — simplified to 2 options */}
        {step === 2 && (
          <div>
            <h3 style={{marginBottom:20,fontWeight:700}}>Outcome</h3>
            <p style={{marginBottom:20,color:'var(--text-secondary)',fontSize:'0.9rem'}}>
              What is the immediate outcome for the injured person?
            </p>

            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {/* Option 1: Send to Doctor */}
              <button
                type="button"
                onClick={() => set('outcome', 'referred_to_doctor')}
                style={{
                  display:'flex', alignItems:'center', gap:16, padding:'20px 24px',
                  background: form.outcome === 'referred_to_doctor' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-app)',
                  border: `2px solid ${form.outcome === 'referred_to_doctor' ? 'var(--blue-600)' : 'var(--border-color)'}`,
                  borderRadius:12, cursor:'pointer', textAlign:'left', transition:'all 0.2s ease'
                }}
              >
                <div style={{
                  width:52,height:52,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                  background: form.outcome === 'referred_to_doctor' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.06)',
                  color: 'var(--blue-600)'
                }}>
                  <Stethoscope size={26} />
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:'1rem',color:'var(--text-main)',marginBottom:4}}>Send to Doctor</div>
                  <div style={{fontSize:'0.85rem',color:'var(--text-secondary)',lineHeight:1.5}}>
                    The injured person needs medical attention. The doctor will be notified and will add treatment details.
                  </div>
                </div>
                <div style={{
                  width:22,height:22,borderRadius:'50%',border:`2px solid ${form.outcome === 'referred_to_doctor' ? 'var(--blue-600)' : 'var(--border-color)'}`,
                  display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0
                }}>
                  {form.outcome === 'referred_to_doctor' && <div style={{width:12,height:12,borderRadius:'50%',background:'var(--blue-600)'}} />}
                </div>
              </button>

              {/* Option 2: Back to Work */}
              <button
                type="button"
                onClick={() => set('outcome', 'returned_to_work')}
                style={{
                  display:'flex', alignItems:'center', gap:16, padding:'20px 24px',
                  background: form.outcome === 'returned_to_work' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-app)',
                  border: `2px solid ${form.outcome === 'returned_to_work' ? '#10B981' : 'var(--border-color)'}`,
                  borderRadius:12, cursor:'pointer', textAlign:'left', transition:'all 0.2s ease'
                }}
              >
                <div style={{
                  width:52,height:52,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                  background: form.outcome === 'returned_to_work' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.06)',
                  color: '#10B981'
                }}>
                  <Briefcase size={26} />
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:'1rem',color:'var(--text-main)',marginBottom:4}}>Back to Work</div>
                  <div style={{fontSize:'0.85rem',color:'var(--text-secondary)',lineHeight:1.5}}>
                    The injured person is able to continue working. This incident will be logged for records.
                  </div>
                </div>
                <div style={{
                  width:22,height:22,borderRadius:'50%',border:`2px solid ${form.outcome === 'returned_to_work' ? '#10B981' : 'var(--border-color)'}`,
                  display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0
                }}>
                  {form.outcome === 'returned_to_work' && <div style={{width:12,height:12,borderRadius:'50%',background:'#10B981'}} />}
                </div>
              </button>
            </div>

            {form.outcome === 'referred_to_doctor' && (
              <div style={{marginTop:16,padding:14,background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.15)',borderRadius:10,display:'flex',gap:10,alignItems:'center',fontSize:'0.85rem',color:'var(--text-secondary)'}}>
                <Stethoscope size={16} color="var(--blue-600)" />
                <span>The doctor will add treatment details, prescriptions, and further assessment to this incident report.</span>
              </div>
            )}

            {(parseInt(form.daysLost) >= 2 || form.severity === 'fatal') && (
              <div style={{padding:16,background:'var(--red-50)',border:'1px solid var(--red-600)',borderRadius:8,display:'flex',gap:10,alignItems:'center',marginTop:16}}>
                <AlertTriangle size={20} color="var(--red-600)" />
                <div><div style={{fontWeight:600,color:'var(--red-600)',fontSize:'0.9rem'}}>This incident is reportable under Section 88</div><div style={{fontSize:'0.82rem',color:'var(--text-secondary)'}}>Form 18 will need to be generated and submitted to the Inspector of Factories.</div></div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{display:'flex',justifyContent:'space-between',marginTop:28,paddingTop:20,borderTop:'1px solid var(--border-color)'}}>
          <button className="btn btn-ghost" onClick={() => setStep(s => s-1)} disabled={step === 0}><ArrowLeft size={16} /> {t('common.back')}</button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep(s => s+1)} disabled={!canNext()}>{t('common.next')} <ArrowRight size={16} /></button>
          ) : (
            <button className="btn btn-success" onClick={handleSubmit} disabled={loading || !canNext()}><Save size={16} /> {loading ? t('common.loading') : t('common.submit')}</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewIncident;
