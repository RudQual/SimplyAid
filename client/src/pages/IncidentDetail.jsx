import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getIncident, updateIncident } from '../services/api';
import { ArrowLeft, Clock, MapPin, User, FileText, Save } from 'lucide-react';
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
    try { const r = await getIncident(id); setIncident(r.data.data); setEditForm({ rootCause: r.data.data.rootCause || '', correctiveAction: r.data.data.correctiveAction || '', preventiveMeasures: r.data.data.preventiveMeasures || '', status: r.data.data.status }); }
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

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/incidents')} style={{marginBottom:8}}><ArrowLeft size={16} /> Back to Incidents</button>
          <h1 className="page-title" style={{display:'flex',alignItems:'center',gap:12}}>
            {inc.incidentId} <span className={`badge badge-${inc.severity}`}>{t(`incidents.${inc.severity}`)}</span> <span className={`badge badge-${inc.status}`}>{t(`incidents.${inc.status}`)}</span>
            {inc.isReportable && <span className="badge" style={{background:'rgba(239,68,68,0.15)',color:'var(--danger)'}}>REPORTABLE</span>}
          </h1>
        </div>
        {hasRole('admin','safety_officer','department_head') && !editing && <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit Investigation</button>}
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
            {editing ? (
              <div>
                <div className="form-group"><label className="form-label">Status</label><select value={editForm.status} onChange={e => setEditForm(f => ({...f, status: e.target.value}))}><option value="reported">Reported</option><option value="under_investigation">Under Investigation</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div>
                <div className="form-group"><label className="form-label">Root Cause</label><textarea rows={3} value={editForm.rootCause} onChange={e => setEditForm(f => ({...f, rootCause: e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Corrective Action</label><textarea rows={3} value={editForm.correctiveAction} onChange={e => setEditForm(f => ({...f, correctiveAction: e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Preventive Measures</label><textarea rows={3} value={editForm.preventiveMeasures} onChange={e => setEditForm(f => ({...f, preventiveMeasures: e.target.value}))} /></div>
                <div style={{display:'flex',gap:8}}><button className="btn btn-success" onClick={handleSave}><Save size={16} /> Save</button><button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button></div>
              </div>
            ) : (
              <div style={{fontSize:'0.9rem'}}>
                <p><strong>Root Cause:</strong> {inc.rootCause || <span style={{color:'var(--text-muted)'}}>Not determined yet</span>}</p>
                <p style={{marginTop:8}}><strong>Corrective Action:</strong> {inc.correctiveAction || <span style={{color:'var(--text-muted)'}}>Pending</span>}</p>
                <p style={{marginTop:8}}><strong>Preventive Measures:</strong> {inc.preventiveMeasures || <span style={{color:'var(--text-muted)'}}>Pending</span>}</p>
              </div>
            )}
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
