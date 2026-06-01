import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createIncident, getDepartments, getUsers, getBoxes } from '../services/api';
import { ArrowLeft, ArrowRight, Save, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = ['Injured Person', 'Incident Details', 'Treatment', 'Outcome'];
const BODY_PARTS = ['Head','Face','Eye','Neck','Shoulder','Arm','Hand','Finger','Chest','Back','Abdomen','Hip','Leg','Knee','Foot','Toe','Multiple'];

const NewIncident = () => {
  const { t, user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    injuredPerson: { name: '', employeeId: '', department: '', age: '', gender: 'male', designation: '' },
    dateTime: new Date().toISOString().slice(0,16), location: '', department: '', incidentType: 'injury',
    severity: 'minor', description: '', causeOfInjury: '', bodyPartAffected: [],
    treatmentGiven: '', treatedBy: '', firstAidBoxUsed: '', outcome: 'returned_to_work',
    hospitalName: '', daysLost: 0, witnesses: ''
  });

  useEffect(() => {
    Promise.all([getDepartments(), getUsers({}), getBoxes({})]).then(([d,u,b]) => {
      setDepartments(d.data.data); setUsers(u.data.data); setBoxes(b.data.data);
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

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const data = { ...form, witnesses: form.witnesses ? form.witnesses.split(',').map(w => w.trim()) : [], daysLost: parseInt(form.daysLost) || 0, injuredPerson: { ...form.injuredPerson, age: parseInt(form.injuredPerson.age) || undefined } };
      await createIncident(data);
      toast.success('Incident reported successfully!');
      navigate('/incidents');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to report incident'); }
    finally { setLoading(false); }
  };

  const canNext = () => {
    if (step === 0) return form.injuredPerson.name && form.injuredPerson.department;
    if (step === 1) return form.department && form.description && form.location;
    if (step === 2) return true;
    return true;
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">{t('incidents.new')}</h1><p className="page-subtitle">Report a new workplace incident</p></div>
        <button className="btn btn-ghost" onClick={() => navigate('/incidents')}><ArrowLeft size={18} />{t('common.back')}</button>
      </div>

      {/* Step indicator */}
      <div className="card" style={{marginBottom:24,padding:'16px 24px'}}>
        <div style={{display:'flex',gap:8}}>
          {STEPS.map((s,i) => (
            <div key={i} style={{flex:1,display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',fontWeight:700,
                background: i <= step ? 'var(--accent)' : 'var(--bg-tertiary)', color: i <= step ? '#fff' : 'var(--text-muted)', flexShrink:0}}>{i+1}</div>
              <span style={{fontSize:'0.82rem',fontWeight:i===step?600:400,color:i===step?'var(--text-primary)':'var(--text-muted)',whiteSpace:'nowrap'}}>{s}</span>
              {i < STEPS.length-1 && <div style={{flex:1,height:2,background:i<step?'var(--accent)':'var(--border)',borderRadius:2}}></div>}
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
              <div className="form-group"><label className="form-label">Department *</label><select value={form.department} onChange={e => set('department', e.target.value)}><option value="">Select</option>{departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Location *</label><input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Where did it happen?" /></div>
              <div className="form-group"><label className="form-label">Type</label><select value={form.incidentType} onChange={e => set('incidentType', e.target.value)}><option value="injury">{t('incidents.injury')}</option><option value="illness">{t('incidents.illness')}</option><option value="near_miss">{t('incidents.near_miss')}</option><option value="dangerous_occurrence">{t('incidents.dangerous_occurrence')}</option></select></div>
            </div>
            <div className="form-group"><label className="form-label">Severity</label>
              <div style={{display:'flex',gap:8}}>{['minor','moderate','serious','fatal'].map(s => (
                <button key={s} type="button" className={`btn btn-sm ${form.severity===s ? `btn-${s==='minor'?'success':s==='moderate'?'warning':'danger'}` : 'btn-ghost'}`} onClick={() => set('severity',s)} style={{textTransform:'capitalize'}}>{t(`incidents.${s}`)}</button>
              ))}</div>
            </div>
            <div className="form-group"><label className="form-label">Description *</label><textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe what happened..." /></div>
            <div className="form-group"><label className="form-label">Cause of Injury</label><input value={form.causeOfInjury} onChange={e => set('causeOfInjury', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Body Parts Affected</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{BODY_PARTS.map(p => (
                <button key={p} type="button" className={`btn btn-sm ${form.bodyPartAffected.includes(p) ? 'btn-primary' : 'btn-ghost'}`} onClick={() => toggleBodyPart(p)}>{p}</button>
              ))}</div>
            </div>
          </div>
        )}

        {/* Step 2: Treatment */}
        {step === 2 && (
          <div>
            <h3 style={{marginBottom:20,fontWeight:700}}>Treatment Details</h3>
            <div className="form-group"><label className="form-label">Treatment Given</label><textarea rows={3} value={form.treatmentGiven} onChange={e => set('treatmentGiven', e.target.value)} placeholder="Describe first aid given..." /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Treated By</label><select value={form.treatedBy} onChange={e => set('treatedBy', e.target.value)}><option value="">Select</option>{users.filter(u => u.firstAidCertified).map(u => <option key={u._id} value={u._id}>{u.name}</option>)}</select></div>
              <div className="form-group"><label className="form-label">First Aid Box Used</label><select value={form.firstAidBoxUsed} onChange={e => set('firstAidBoxUsed', e.target.value)}><option value="">Select</option>{boxes.map(b => <option key={b._id} value={b._id}>{b.boxId} - {b.location}</option>)}</select></div>
            </div>
            <div className="form-group"><label className="form-label">Witnesses (comma separated)</label><input value={form.witnesses} onChange={e => set('witnesses', e.target.value)} placeholder="Name 1, Name 2" /></div>
          </div>
        )}

        {/* Step 3: Outcome */}
        {step === 3 && (
          <div>
            <h3 style={{marginBottom:20,fontWeight:700}}>Outcome</h3>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Outcome *</label><select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                <option value="returned_to_work">Returned to Work</option><option value="sent_home">Sent Home</option><option value="hospitalized">Hospitalized</option>
                <option value="referred_to_doctor">Referred to Doctor</option><option value="under_observation">Under Observation</option><option value="fatal">Fatal</option>
              </select></div>
              <div className="form-group"><label className="form-label">Days Lost</label><input type="number" value={form.daysLost} onChange={e => set('daysLost', e.target.value)} min={0} /></div>
            </div>
            {form.outcome === 'hospitalized' && <div className="form-group"><label className="form-label">Hospital Name</label><input value={form.hospitalName} onChange={e => set('hospitalName', e.target.value)} /></div>}
            {(parseInt(form.daysLost) >= 2 || form.severity === 'fatal') && (
              <div style={{padding:16,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,display:'flex',gap:10,alignItems:'center',marginTop:12}}>
                <AlertTriangle size={20} color="var(--danger)" />
                <div><div style={{fontWeight:600,color:'var(--danger)',fontSize:'0.9rem'}}>This incident is reportable under Section 88</div><div style={{fontSize:'0.82rem',color:'var(--text-secondary)'}}>Form 18 will need to be generated and submitted to the Inspector of Factories.</div></div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{display:'flex',justifyContent:'space-between',marginTop:28,paddingTop:20,borderTop:'1px solid var(--border)'}}>
          <button className="btn btn-ghost" onClick={() => setStep(s => s-1)} disabled={step === 0}><ArrowLeft size={16} /> {t('common.back')}</button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep(s => s+1)} disabled={!canNext()}>{t('common.next')} <ArrowRight size={16} /></button>
          ) : (
            <button className="btn btn-success" onClick={handleSubmit} disabled={loading}><Save size={16} /> {loading ? t('common.loading') : t('common.submit')}</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewIncident;
