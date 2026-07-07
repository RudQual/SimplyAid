import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getIncident, updateIncident } from '../services/api';
import { ArrowLeft, Clock, MapPin, User, FileText, Save, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const IncidentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, hasRole } = useAuth();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => { loadIncident(); }, [id]);

  const loadIncident = async () => {
    try { 
      const r = await getIncident(id); 
      setIncident(r.data.data); 
      setEditForm({ 
        rootCause: r.data.data.rootCause || '', 
        correctiveAction: r.data.data.correctiveAction || '', 
        preventiveMeasures: r.data.data.preventiveMeasures || '', 
        status: r.data.data.status,
        severity: r.data.data.severity,
        description: r.data.data.description,
        location: r.data.data.location,
        outcome: r.data.data.outcome,
        treatmentGiven: r.data.data.treatmentGiven || '',
        daysLost: r.data.data.daysLost || 0
      }); 
    }
    catch (e) { toast.error('Failed to load incident'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try { await updateIncident(id, editForm); toast.success('Incident updated'); setEditing(false); loadIncident(); }
    catch (e) { toast.error('Update failed'); }
  };

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;
  if (!incident) return <div className="page-content"><p>Incident not found</p></div>;
  const inc = incident;

  if (editing) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} style={{marginBottom:8}}><ArrowLeft size={16} /> Cancel Editing</button>
            <h1 className="page-title">Edit Incident Report</h1>
          </div>
        </div>
        <div className="card" style={{display:'flex',flexDirection:'column',gap:20}}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select value={editForm.status} onChange={e => setEditForm(f => ({...f, status: e.target.value}))}>
                <option value="reported">Reported</option>
                <option value="under_investigation">Under Investigation</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Outcome</label>
              <select value={editForm.outcome} onChange={e => setEditForm(f => ({...f, outcome: e.target.value}))}>
                <option value="pending_confirmation">Pending Confirmation</option>
                <option value="returned_to_work">Returned to Work</option>
                <option value="sent_home">Sent Home</option>
                <option value="hospitalized">Hospitalized</option>
                <option value="referred_to_doctor">Referred to Doctor</option>
                <option value="under_observation">Under Observation</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Severity</label>
              <select value={editForm.severity} onChange={e => setEditForm(f => ({...f, severity: e.target.value}))}>
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="serious">Serious</option>
                <option value="fatal">Fatal</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Days Lost</label>
              <input type="number" value={editForm.daysLost} onChange={e => setEditForm(f => ({...f, daysLost: parseInt(e.target.value) || 0}))} />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Location</label>
            <input value={editForm.location} onChange={e => setEditForm(f => ({...f, location: e.target.value}))} />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea rows={3} value={editForm.description} onChange={e => setEditForm(f => ({...f, description: e.target.value}))} />
          </div>
          
          <div className="form-group">
            <label className="form-label">Treatment Given</label>
            <textarea rows={2} value={editForm.treatmentGiven} onChange={e => setEditForm(f => ({...f, treatmentGiven: e.target.value}))} />
          </div>

          <h3 className="card-title" style={{marginTop: 10, borderBottom:'1px solid var(--border-color)', paddingBottom:8}}>Investigation Details</h3>
          
          <div className="form-group">
            <label className="form-label">Root Cause</label>
            <textarea rows={3} value={editForm.rootCause} onChange={e => setEditForm(f => ({...f, rootCause: e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Corrective Action</label>
            <textarea rows={3} value={editForm.correctiveAction} onChange={e => setEditForm(f => ({...f, correctiveAction: e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Preventive Measures</label>
            <textarea rows={3} value={editForm.preventiveMeasures} onChange={e => setEditForm(f => ({...f, preventiveMeasures: e.target.value}))} />
          </div>
          
          <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-success" onClick={handleSave}><Save size={16} /> Save Changes</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {inc.pendingManagerAssist && hasRole('manager') && (
        <div style={{
          background: 'rgba(249, 115, 22, 0.1)',
          border: '1.5px solid rgba(249, 115, 22, 0.3)',
          borderRadius: 12,
          padding: '16px',
          marginBottom: 20,
          color: '#f97316',
          fontWeight: 600,
          fontSize: '0.95rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <span>This incident report is to be filled by you because the employee didn't fill it.</span>
          </div>
          <button 
            className="btn" 
            onClick={() => navigate(`/manager-dashboard?fillIncidentId=${inc._id}`)}
            style={{
              background: '#f97316', color: '#fff', border: 'none', 
              padding: '8px 16px', borderRadius: 8, fontWeight: 700, 
              fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', 
              alignItems: 'center', gap: 6
            }}
          >
            Go to Confirmations to Fill
          </button>
        </div>
      )}

      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/incidents')} style={{marginBottom:8}}><ArrowLeft size={16} /> Back to Incidents</button>
          <h1 className="page-title" style={{display:'flex',alignItems:'center',gap:12}}>
            {inc.incidentId} <span className={`badge badge-${inc.severity}`}>{t(`incidents.${inc.severity}`)}</span> <span className={`badge badge-${inc.status}`}>{t(`incidents.${inc.status}`)}</span>
            {inc.isReportable && <span className="badge" style={{background:'rgba(239,68,68,0.15)',color:'var(--danger)'}}>REPORTABLE</span>}
          </h1>
        </div>
        {hasRole('doctor', 'manager') && <button className="btn btn-primary" onClick={() => setEditing(true)}><FileText size={16} /> Edit Report</button>}
      </div>

      <div className="grid-2">
        {/* Left: Details */}
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:16}}>Injured Person</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 24px',fontSize:'0.9rem'}}>
              <div><span style={{color:'var(--text-muted)'}}>Name:</span> <strong>{inc.injuredPerson?.name}</strong></div>
              <div><span style={{color:'var(--text-muted)'}}>Employee ID:</span> {inc.injuredPerson?.employeeId || '-'}</div>
              <div><span style={{color:'var(--text-muted)'}}>Department:</span> {inc.injuredPerson?.department?.name || inc.department?.name}</div>
              <div><span style={{color:'var(--text-muted)'}}>Age/Gender:</span> {inc.injuredPerson?.age || '-'} / {inc.injuredPerson?.gender}</div>
            </div>
          </div>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:16}}>Incident Details</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 24px',fontSize:'0.9rem'}}>
              <div><Clock size={14} style={{verticalAlign:'middle'}} /> {new Date(inc.dateTime).toLocaleString()}</div>
              <div><MapPin size={14} style={{verticalAlign:'middle'}} /> {inc.location}</div>
              <div><span style={{color:'var(--text-muted)'}}>Type:</span> {t(`incidents.${inc.incidentType}`)}</div>
              <div><span style={{color:'var(--text-muted)'}}>Days Lost:</span> {inc.daysLost}</div>
            </div>
            <div style={{marginTop:16}}><span style={{color:'var(--text-muted)',fontSize:'0.85rem'}}>Description:</span><p style={{marginTop:6,lineHeight:1.7}}>{inc.description}</p></div>
            {inc.bodyPartAffected?.length > 0 && <div style={{marginTop:12,display:'flex',gap:6,flexWrap:'wrap'}}>{inc.bodyPartAffected.map(p => <span key={p} className="badge badge-reported">{p}</span>)}</div>}
          </div>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:16}}>Treatment & Outcome</h3>
            <p style={{fontSize:'0.9rem'}}><strong>Treatment:</strong> {inc.treatmentGiven || 'Not recorded'}</p>
            <p style={{fontSize:'0.9rem',marginTop:8}}><strong>Treated By:</strong> {inc.treatedBy?.name || '-'}</p>
            <p style={{fontSize:'0.9rem',marginTop:8}}><strong>Outcome:</strong> <span style={{textTransform:'capitalize'}}>{inc.outcome?.replace(/_/g,' ')}</span></p>
            {inc.hospitalName && <p style={{fontSize:'0.9rem',marginTop:8}}><strong>Hospital:</strong> {inc.hospitalName}</p>}
          </div>
        </div>

        {/* Right: Investigation + Timeline */}
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:16}}>Investigation</h3>
            <div style={{fontSize:'0.9rem'}}>
              <p><strong>Root Cause:</strong> {inc.rootCause || <span style={{color:'var(--text-muted)'}}>Not determined yet</span>}</p>
              <p style={{marginTop:8}}><strong>Corrective Action:</strong> {inc.correctiveAction || <span style={{color:'var(--text-muted)'}}>Pending</span>}</p>
              <p style={{marginTop:8}}><strong>Preventive Measures:</strong> {inc.preventiveMeasures || <span style={{color:'var(--text-muted)'}}>Pending</span>}</p>
            </div>
          </div>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:16}}>Status Timeline</h3>
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              {(inc.statusHistory || []).map((sh, i) => (
                <div key={i} style={{display:'flex',gap:12,paddingBottom:16,position:'relative'}}>
                  <div style={{width:12,height:12,borderRadius:'50%',background:'var(--accent)',marginTop:4,flexShrink:0,zIndex:1}}></div>
                  {i < inc.statusHistory.length-1 && <div style={{position:'absolute',left:5,top:16,width:2,height:'calc(100% - 4px)',background:'var(--border)'}}></div>}
                  <div><div style={{fontWeight:600,fontSize:'0.85rem',textTransform:'capitalize'}}>{sh.status?.replace(/_/g,' ')}</div><div style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>{sh.changedBy?.name} · {new Date(sh.changedAt).toLocaleString()}</div>{sh.notes && <div style={{fontSize:'0.82rem',color:'var(--text-secondary)',marginTop:2}}>{sh.notes}</div>}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentDetail;
