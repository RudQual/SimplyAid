import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getIncident, updateIncident, downloadForm18 } from '../services/api';
import { errorMessage, saveBlob, formatDateTime } from '../utils/format';
import { ArrowLeft, Clock, MapPin, FileText, Save, AlertTriangle, FileDown, Siren, SearchX } from 'lucide-react';
import toast from 'react-hot-toast';

const IncidentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, hasRole } = useAuth();
  const [loadError, setLoadError] = useState(null);
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => { setLoading(true); setLoadError(null); loadIncident(); }, [id]);

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
    catch (e) { setLoadError(errorMessage(e, t('incidents.notFound'))); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try { await updateIncident(id, { ...editForm, daysLost: Number(editForm.daysLost) || 0 }); toast.success(t('incidents.updated')); setEditing(false); loadIncident(); }
    catch (e) { toast.error(errorMessage(e, t('incidents.updateFailed'))); }
  };

  const handleForm18 = async () => {
    try {
      const res = await downloadForm18(id);
      saveBlob(res.data, `Form18-${incident.incidentId}.pdf`);
      toast.success('Form 18 generated');
      loadIncident();
    } catch (e) { toast.error(errorMessage(e, 'Could not generate Form 18')); }
  };

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;
  if (!incident) return (
    <div className="page-content">
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon"><SearchX size={22} /></div>
          <h3>{t('incidents.notFound')}</h3>
          <p>{loadError && loadError !== t('incidents.notFound') ? loadError : t('incidents.notFoundText')}</p>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/incidents')}><ArrowLeft size={14} /> {t('incidents.back')}</button>
        </div>
      </div>
    </div>
  );
  const inc = incident;

  if (editing) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} style={{marginBottom:8}}><ArrowLeft size={16} /> {t('incidents.cancelEdit')}</button>
            <h1 className="page-title">{t('incidents.editTitle')}</h1>
          </div>
        </div>
        <div className="card" style={{display:'flex',flexDirection:'column',gap:20}}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{t('incidents.status')}</label>
              <select value={editForm.status} onChange={e => setEditForm(f => ({...f, status: e.target.value}))}>
                {['reported', 'under_investigation', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{t(`incidents.${s}`)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('incidents.outcome')}</label>
              <select value={editForm.outcome} onChange={e => setEditForm(f => ({...f, outcome: e.target.value}))}>
                {['pending_confirmation', 'returned_to_work', 'sent_home', 'hospitalized', 'referred_to_doctor', 'under_observation'].map((o) => <option key={o} value={o}>{t(`outcome.${o}`)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('incidents.severity')}</label>
              <select value={editForm.severity} onChange={e => setEditForm(f => ({...f, severity: e.target.value}))}>
                {['minor', 'moderate', 'serious', 'fatal'].map((s) => <option key={s} value={s}>{t(`incidents.${s}`)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('incidents.daysLost')}</label>
              <input type="number" value={editForm.daysLost} onChange={e => setEditForm(f => ({...f, daysLost: parseInt(e.target.value) || 0}))} />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">{t('incidents.location')}</label>
            <input value={editForm.location} onChange={e => setEditForm(f => ({...f, location: e.target.value}))} />
          </div>

          <div className="form-group">
            <label className="form-label">{t('incidents.description')}</label>
            <textarea rows={3} value={editForm.description} onChange={e => setEditForm(f => ({...f, description: e.target.value}))} />
          </div>
          
          <div className="form-group">
            <label className="form-label">{t('incidents.treatment')}</label>
            <textarea rows={2} value={editForm.treatmentGiven} onChange={e => setEditForm(f => ({...f, treatmentGiven: e.target.value}))} />
          </div>

          <h3 className="card-title" style={{marginTop: 10, borderBottom:'1px solid var(--border-color)', paddingBottom:8}}>{t('incidents.investigationDetails')}</h3>
          
          <div className="form-group">
            <label className="form-label">{t('incidents.rootCause')}</label>
            <textarea rows={3} value={editForm.rootCause} onChange={e => setEditForm(f => ({...f, rootCause: e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('incidents.correctiveAction')}</label>
            <textarea rows={3} value={editForm.correctiveAction} onChange={e => setEditForm(f => ({...f, correctiveAction: e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('incidents.preventive')}</label>
            <textarea rows={3} value={editForm.preventiveMeasures} onChange={e => setEditForm(f => ({...f, preventiveMeasures: e.target.value}))} />
          </div>
          
          <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
            <button className="btn btn-success" onClick={handleSave}><Save size={16} /> {t('incidents.saveChanges')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {inc.isSOS && inc.status === 'reported' && (
        <div className="sos-banner" role="alert">
          <Siren size={22} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{t('sos.banner')} · <span className="mono">{inc.incidentId}</span></strong>
            <p>{hasRole('employee') ? t('sos.employeeBanner') : t('sos.bannerText', { name: inc.injuredPerson?.name, location: inc.location })}</p>
          </div>
          {inc.pendingManagerAssist && hasRole('manager') && (
            <button className="btn" onClick={() => navigate(`/reviews?fillIncidentId=${inc._id}`)}>{t('sos.fillNow')}</button>
          )}
        </div>
      )}
      {inc.pendingManagerAssist && hasRole('manager') && !inc.isSOS && (
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
            <span>{t('incidents.fillBanner')}</span>
          </div>
          <button 
            className="btn" 
            onClick={() => navigate(`/reviews?fillIncidentId=${inc._id}`)}
            style={{
              background: '#f97316', color: '#fff', border: 'none', 
              padding: '8px 16px', borderRadius: 8, fontWeight: 700, 
              fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', 
              alignItems: 'center', gap: 6
            }}
          >
            {t('incidents.goFill')}
          </button>
        </div>
      )}

      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/incidents')} style={{marginBottom:8}}><ArrowLeft size={16} /> {t('incidents.back')}</button>
          <h1 className="page-title" style={{display:'flex',alignItems:'center',gap:12}}>
            <span className="mono">{inc.incidentId}</span> {inc.isSOS && <span className="badge badge-sos">{t('sos.badge')}</span>} <span className={`badge badge-${inc.severity}`}>{t(`incidents.${inc.severity}`)}</span> <span className={`badge badge-${inc.status}`}>{t(`incidents.${inc.status}`)}</span>
            {inc.isReportable && <span className="badge badge-red">{t('incidents.reportable')} · {t('incidents.form18')} {inc.form18Generated ? t('incidents.form18Filed') : t('incidents.form18Pending')}</span>}
          </h1>
        </div>
        {hasRole('doctor', 'manager', 'admin') && (
          <div className="page-actions">
            {inc.isReportable && <button className="btn btn-secondary" onClick={handleForm18}><FileDown size={16} /> {inc.form18Generated ? t('incidents.dlForm18') : t('incidents.genForm18')}</button>}
            <button className="btn btn-primary" onClick={() => setEditing(true)}><FileText size={16} /> {t('incidents.editReport')}</button>
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* Left: Details */}
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:16}}>{t('incidents.injuredPerson')}</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 24px',fontSize:'0.9rem'}}>
              <div><span style={{color:'var(--text-muted)'}}>{t('incidents.name')}:</span> <strong>{inc.injuredPerson?.name}</strong></div>
              <div><span style={{color:'var(--text-muted)'}}>{t('incidents.employeeId')}:</span> {inc.injuredPerson?.employeeId || '-'}</div>
              <div><span style={{color:'var(--text-muted)'}}>{t('incidents.department')}:</span> {inc.injuredPerson?.department?.name || inc.department?.name}</div>
              <div><span style={{color:'var(--text-muted)'}}>{t('incidents.ageGender')}:</span> {inc.injuredPerson?.age || '-'} / {inc.injuredPerson?.gender}</div>
            </div>
          </div>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:16}}>{t('incidents.incidentDetails')}</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 24px',fontSize:'0.9rem'}}>
              <div><Clock size={14} style={{verticalAlign:'middle'}} /> {formatDateTime(inc.dateTime)}</div>
              <div><MapPin size={14} style={{verticalAlign:'middle'}} /> {inc.location}</div>
              <div><span style={{color:'var(--text-muted)'}}>{t('incidents.type')}:</span> {t(`incidents.${inc.incidentType}`)}</div>
              <div><span style={{color:'var(--text-muted)'}}>{t('incidents.daysLost')}:</span> {inc.daysLost}</div>
            </div>
            <div style={{marginTop:16}}><span style={{color:'var(--text-muted)',fontSize:'0.85rem'}}>{t('incidents.description')}:</span><p style={{marginTop:6,lineHeight:1.7}}>{inc.description}</p></div>
            {inc.bodyPartAffected?.length > 0 && <div style={{marginTop:12,display:'flex',gap:6,flexWrap:'wrap'}}>{inc.bodyPartAffected.map(p => <span key={p} className="badge badge-reported">{t(`bodyParts.${p}`, null, p)}</span>)}</div>}
          </div>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:16}}>{t('incidents.treatmentOutcome')}</h3>
            <p style={{fontSize:'0.9rem'}}><strong>{t('incidents.treatment')}:</strong> {inc.treatmentGiven || t('incidents.notRecorded')}</p>
            <p style={{fontSize:'0.9rem',marginTop:8}}><strong>{t('incidents.treatedBy')}:</strong> {inc.treatedBy?.name || '-'}</p>
            <p style={{fontSize:'0.9rem',marginTop:8}}><strong>{t('incidents.outcome')}:</strong> <span>{t(`outcome.${inc.outcome}`, null, inc.outcome?.replace(/_/g,' '))}</span></p>
            {inc.hospitalName && <p style={{fontSize:'0.9rem',marginTop:8}}><strong>{t('incidents.hospital')}:</strong> {inc.hospitalName}</p>}
          </div>
        </div>

        {/* Right: Investigation + Timeline */}
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:16}}>{t('incidents.investigation')}</h3>
            <div style={{fontSize:'0.9rem'}}>
              <p><strong>{t('incidents.rootCause')}:</strong> {inc.rootCause || <span style={{color:'var(--text-muted)'}}>{t('incidents.notDetermined')}</span>}</p>
              <p style={{marginTop:8}}><strong>{t('incidents.correctiveAction')}:</strong> {inc.correctiveAction || <span style={{color:'var(--text-muted)'}}>{t('incidents.pending')}</span>}</p>
              <p style={{marginTop:8}}><strong>{t('incidents.preventive')}:</strong> {inc.preventiveMeasures || <span style={{color:'var(--text-muted)'}}>{t('incidents.pending')}</span>}</p>
            </div>
          </div>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:16}}>{t('incidents.timeline')}</h3>
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              {(inc.statusHistory || []).map((sh, i) => (
                <div key={i} style={{display:'flex',gap:12,paddingBottom:16,position:'relative'}}>
                  <div style={{width:12,height:12,borderRadius:'50%',background:'var(--accent)',marginTop:4,flexShrink:0,zIndex:1}}></div>
                  {i < inc.statusHistory.length-1 && <div style={{position:'absolute',left:5,top:16,width:2,height:'calc(100% - 4px)',background:'var(--border)'}}></div>}
                  <div><div style={{fontWeight:600,fontSize:'0.85rem',}}>{t(`incidents.${sh.status}`, null, sh.status?.replace(/_/g,' '))}</div><div style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>{sh.changedBy?.name} · {formatDateTime(sh.changedAt)}</div>{sh.notes && <div style={{fontSize:'0.82rem',color:'var(--text-secondary)',marginTop:2}}>{sh.notes}</div>}</div>
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
