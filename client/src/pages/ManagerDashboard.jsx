import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getIncidents, managerConfirmIncident, managerFillIncident, getBoxes, getMedicationOptions } from '../services/api';
import { ClipboardCheck, AlertTriangle, Eye, Send, MapPin, Clock, User, FileEdit, Package, X, ChevronDown, Plus, Trash2, Stethoscope, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

const severityColors = {
  minor:    { bg: 'rgba(34, 197, 94, 0.1)',  color: '#22c55e', border: 'rgba(34, 197, 94, 0.2)'  },
  moderate: { bg: 'rgba(234, 179, 8, 0.1)',  color: '#eab308', border: 'rgba(234, 179, 8, 0.2)'  },
  serious:  { bg: 'rgba(239, 68, 68, 0.1)',  color: '#ef4444', border: 'rgba(239, 68, 68, 0.2)'  },
  fatal:    { bg: 'rgba(127, 29, 29, 0.15)', color: '#dc2626', border: 'rgba(127, 29, 29, 0.3)'  },
};

const EMPTY_FILL = {
  incidentType: 'illness',
  severity: 'minor',
  location: '',
  description: '',
  causeOfInjury: '',
  treatmentGiven: '',
  outcome: 'returned_to_work',
  firstAidBoxUsed: '',
  managerNotes: '',
};

const ManagerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fillIncidentId = searchParams.get('fillIncidentId');

  const [incidents, setIncidents]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [confirmingId, setConfirmingId]   = useState(null);
  const [confirmNotes, setConfirmNotes]   = useState('');
  const [showModal, setShowModal]         = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Fill-report state
  const [fillTarget, setFillTarget]       = useState(null);   // incident being filled
  const [fillData, setFillData]           = useState({ ...EMPTY_FILL });
  const [fillItems, setFillItems]         = useState([{ itemId: '', quantity: 1 }]);
  const [fillSubmitting, setFillSubmitting] = useState(false);
  const [boxes, setBoxes]                 = useState([]);
  const [items, setItems]                 = useState([]);

  useEffect(() => { loadAll(); }, [fillIncidentId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [res, boxRes, medRes] = await Promise.all([
        getIncidents({ status: 'reported', limit: 100 }),
        getBoxes({}),
        getMedicationOptions(),
      ]);
      // Also fetch incidents with pending_confirmation outcome (may be status: reported OR under_investigation)
      const pendingConfRes = await getIncidents({ outcome: 'pending_confirmation', limit: 100 });
      const loadedIncidents = res.data.data || [];
      const pendingConfIncidents = (pendingConfRes.data.data || []).filter(
        pc => !loadedIncidents.some(i => i._id === pc._id)
      );
      const allIncidents = [...loadedIncidents, ...pendingConfIncidents];
      setIncidents(allIncidents);
      setBoxes(boxRes.data.data || []);
      const { items: itemList } = medRes.data.data;
      const finalItems = itemList || [];
      setItems(finalItems);

      // Auto-open if query parameter exists
      if (fillIncidentId) {
        const found = allIncidents.find(i => i._id === fillIncidentId);
        if (found) {
          setFillTarget(found);
          setFillData({ ...EMPTY_FILL });
          setFillItems([{ itemId: finalItems[0]?._id || '', quantity: 1 }]);
        }
      }
    } catch (e) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // ── Normal confirm ─────────────────────────────────────────────
  const openConfirmModal = (incident) => {
    setSelectedIncident(incident);
    setConfirmNotes('');
    setShowModal(true);
  };

  const handleConfirm = async () => {
    if (!selectedIncident) return;
    setConfirmingId(selectedIncident._id);
    try {
      const payload = { notes: confirmNotes };
      // If this incident needs an outcome decision, include it
      if (confirmOutcome) {
        payload.outcome = confirmOutcome;
      }
      await managerConfirmIncident(selectedIncident._id, payload);
      const msg = confirmOutcome === 'referred_to_doctor' 
        ? 'Incident confirmed — sent to doctor!' 
        : confirmOutcome === 'returned_to_work'
          ? 'Incident confirmed — worker returned to work!'
          : 'Incident confirmed and sent to doctor!';
      toast.success(msg);
      setShowModal(false);
      setSelectedIncident(null);
      setConfirmOutcome('');
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to confirm incident');
    } finally {
      setConfirmingId(null); }
  };

  // ── Fill report ─────────────────────────────────────────────────
  const openFillForm = (incident) => {
    setFillTarget(incident);
    setFillData({ ...EMPTY_FILL });
    setFillItems([{ itemId: items[0]?._id || '', quantity: 1 }]);
  };

  const closeFillForm = () => { setFillTarget(null); };

  const setFill = (key, val) => setFillData(prev => ({ ...prev, [key]: val }));

  const handleFillItemChange = (idx, field, val) => {
    setFillItems(prev => { const u = [...prev]; u[idx][field] = val; return u; });
  };
  const addFillItem    = () => setFillItems(prev => [...prev, { itemId: items[0]?._id || '', quantity: 1 }]);
  const removeFillItem = (idx) => setFillItems(prev => prev.filter((_, i) => i !== idx));

  const handleFillSubmit = async (e) => {
    e.preventDefault();
    if (!fillData.description.trim()) return toast.error('Please add a description of the incident');
    if (!fillData.location.trim())    return toast.error('Please add the incident location');
    setFillSubmitting(true);
    try {
      const validItems = fillItems.filter(i => i.itemId && Number(i.quantity) > 0);
      const payload = {
        ...fillData,
        firstAidBoxUsed: fillData.firstAidBoxUsed || undefined,
        itemsUsed: validItems.map(i => {
          const found = items.find(it => it._id === i.itemId);
          return { item: i.itemId, itemName: found?.name || '', quantity: Number(i.quantity) };
        }),
      };
      await managerFillIncident(fillTarget._id, payload);
      toast.success('Report filed and forwarded to doctor!');
      setFillTarget(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit report');
    } finally {
      setFillSubmitting(false);
    }
  };

  const pendingAssist  = incidents.filter(i => i.pendingManagerAssist);
  const pendingOutcome  = incidents.filter(i => i.outcome === 'pending_confirmation' && !i.pendingManagerAssist && !i.managerConfirmation);
  const normalPending   = incidents.filter(i => !i.pendingManagerAssist && i.outcome !== 'pending_confirmation' && !i.managerConfirmation);

  // State for outcome selection in the confirmation modal
  const [confirmOutcome, setConfirmOutcome] = useState('');

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manager Dashboard</h1>
          <p className="page-subtitle">Review incidents and assist employees on-site</p>
        </div>
        <div className="stats-badge">
          <AlertTriangle size={18} />
          <span>{incidents.length} Pending</span>
        </div>
      </div>

      {loading ? (
        <div className="page-loader"><div className="spinner"></div></div>
      ) : incidents.length === 0 ? (
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <ClipboardCheck size={48} style={{ color: 'var(--accent)', marginBottom: 16 }} />
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>All Clear!</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No pending incidents require your attention.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* ── SECTION 1: Needs Manager to Fill ─────────────────── */}
          {pendingAssist.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316', animation: 'pulse 1.5s infinite' }}></div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Needs Your Help — Employee Could Not Fill the Report
                </h2>
                <span style={{ marginLeft: 'auto', padding: '3px 10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, color: '#f97316' }}>
                  {pendingAssist.length} urgent
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {pendingAssist.map(incident => (
                  <div key={incident._id}>
                    {/* Incident card */}
                    <div className="card" style={{ padding: '20px 24px', border: '1.5px solid rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.03)' }}>
                      {/* assist banner */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 14px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 10 }}>
                        <AlertTriangle size={16} color="#f97316" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f97316' }}>
                          Employee was unable to fill this report — please visit them and complete it below.
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 250 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)', fontSize: '0.9rem' }}>{incident.incidentId}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <User size={14} /> {incident.injuredPerson?.name || 'Unknown'}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={14} /> {new Date(incident.dateTime || incident.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary" onClick={() => navigate(`/incidents/${incident._id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Eye size={16} /> View
                          </button>
                          <button
                            className="btn"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff' }}
                            onClick={() => fillTarget?._id === incident._id ? closeFillForm() : openFillForm(incident)}
                          >
                            <FileEdit size={16} />
                            {fillTarget?._id === incident._id ? 'Close Form' : 'Fill Report'}
                            <ChevronDown size={14} style={{ transform: fillTarget?._id === incident._id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── Inline fill form ── */}
                    {fillTarget?._id === incident._id && (
                      <div className="card" style={{ marginTop: 8, padding: '24px', border: '1.5px solid rgba(249,115,22,0.35)', borderTop: 'none', borderRadius: '0 0 16px 16px' }}>
                        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FileEdit size={18} color="#f97316" /> Fill Incident Report for {fillTarget.injuredPerson?.name}
                        </h3>

                        <form onSubmit={handleFillSubmit}>
                          {/* Row 1 */}
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Incident Type *</label>
                              <select value={fillData.incidentType} onChange={e => setFill('incidentType', e.target.value)}>
                                <option value="injury">Injury</option>
                                <option value="illness">Illness</option>
                                <option value="near_miss">Near Miss</option>
                                <option value="dangerous_occurrence">Dangerous Occurrence</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Severity *</label>
                              <select value={fillData.severity} onChange={e => setFill('severity', e.target.value)}>
                                <option value="minor">Minor</option>
                                <option value="moderate">Moderate</option>
                                <option value="serious">Serious</option>
                                <option value="fatal">Fatal</option>
                              </select>
                            </div>
                          </div>

                          {/* Location */}
                          <div className="form-group">
                            <label className="form-label">Incident Location *</label>
                            <input
                              value={fillData.location}
                              onChange={e => setFill('location', e.target.value)}
                              placeholder="Where exactly did it happen?"
                              required
                            />
                          </div>

                          {/* Description */}
                          <div className="form-group">
                            <label className="form-label">Description of Incident *</label>
                            <textarea
                              rows={4}
                              value={fillData.description}
                              onChange={e => setFill('description', e.target.value)}
                              placeholder="Describe what happened on-site..."
                              required
                            />
                          </div>

                          {/* Cause */}
                          <div className="form-group">
                            <label className="form-label">Cause of Injury / Illness</label>
                            <input value={fillData.causeOfInjury} onChange={e => setFill('causeOfInjury', e.target.value)} placeholder="e.g. Slipped on wet floor" />
                          </div>

                          {/* Treatment */}
                          <div className="form-group">
                            <label className="form-label">Treatment Given</label>
                            <textarea rows={3} value={fillData.treatmentGiven} onChange={e => setFill('treatmentGiven', e.target.value)} placeholder="First aid administered..." />
                          </div>

                          {/* Outcome */}
                          <div className="form-group">
                            <label className="form-label">Outcome</label>
                            <select value={fillData.outcome} onChange={e => setFill('outcome', e.target.value)}>
                              <option value="returned_to_work">Returned to Work</option>
                              <option value="sent_home">Sent Home</option>
                              <option value="hospitalized">Hospitalized</option>
                              <option value="referred_to_doctor">Referred to Doctor</option>
                              <option value="under_observation">Under Observation</option>
                            </select>
                          </div>

                          {/* First Aid Box */}
                          <div className="form-group">
                            <label className="form-label"><Package size={14} style={{ display: 'inline', marginRight: 4 }} />First Aid Box Used</label>
                            <select value={fillData.firstAidBoxUsed} onChange={e => setFill('firstAidBoxUsed', e.target.value)}>
                              <option value="">None / Not applicable</option>
                              {boxes.map(b => <option key={b._id} value={b._id}>{b.boxId} — {b.location}</option>)}
                            </select>
                          </div>

                          {/* Items used */}
                          {fillData.firstAidBoxUsed && (
                            <div className="form-group">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <label className="form-label" style={{ margin: 0 }}>Items / Medications Used</label>
                                <button type="button" onClick={addFillItem} style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', padding: '4px 10px', borderRadius: 16, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Plus size={13} /> Add Item
                                </button>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {fillItems.map((row, idx) => (
                                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-app)', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                                    <div style={{ flex: 1 }}>
                                      <select value={row.itemId} onChange={e => handleFillItemChange(idx, 'itemId', e.target.value)} style={{ width: '100%', margin: 0 }}>
                                        <option value="">Select item...</option>
                                        {items.map(it => <option key={it._id} value={it._id}>{it.name} ({it.category})</option>)}
                                      </select>
                                    </div>
                                    <div style={{ width: 80 }}>
                                      <input type="number" min="1" value={row.quantity} onChange={e => handleFillItemChange(idx, 'quantity', e.target.value)} placeholder="Qty" style={{ margin: 0, width: '100%', textAlign: 'center' }} />
                                    </div>
                                    {fillItems.length > 1 && (
                                      <button type="button" onClick={() => removeFillItem(idx)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Manager notes */}
                          <div className="form-group">
                            <label className="form-label">Your On-Site Notes (for doctor)</label>
                            <textarea rows={2} value={fillData.managerNotes} onChange={e => setFill('managerNotes', e.target.value)} placeholder="Additional observations..." />
                          </div>

                          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                            <button type="button" className="btn btn-secondary" onClick={closeFillForm}>Cancel</button>
                            <button type="submit" className="btn" style={{ background: '#f97316', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }} disabled={fillSubmitting}>
                              {fillSubmitting ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span> Submitting...</> : <><Send size={16} /> Submit & Forward to Doctor</>}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SECTION 1.5: Pending Outcome Decision ─────────────── */}
          {pendingOutcome.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1', animation: 'pulse 1.5s infinite' }}></div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Awaiting Your Outcome Decision
                </h2>
                <span style={{ marginLeft: 'auto', padding: '3px 10px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, color: '#6366f1' }}>
                  {pendingOutcome.length} pending
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {pendingOutcome.map(incident => {
                  const sev = severityColors[incident.severity] || severityColors.minor;
                  return (
                    <div key={incident._id} className="card" style={{ padding: '20px 24px', border: '1.5px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.02)' }}>
                      {/* Pending banner */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10 }}>
                        <Clock size={16} color="#6366f1" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6366f1' }}>
                          The worker could not decide — please visit on-site and choose the outcome below.
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 250 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)', fontSize: '0.9rem' }}>{incident.incidentId}</span>
                            <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                              {incident.severity?.toUpperCase()}
                            </span>
                          </div>
                          <p style={{ margin: '0 0 10px', color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1.5 }}>
                            {incident.description?.substring(0, 150)}{incident.description?.length > 150 ? '...' : ''}
                          </p>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={14} /> {incident.injuredPerson?.name || 'Unknown'}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={14} /> {incident.location}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={14} /> {new Date(incident.dateTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary" onClick={() => navigate(`/incidents/${incident._id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Eye size={16} /> View
                          </button>
                          <button
                            className="btn"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#10B981', color: '#fff' }}
                            onClick={() => { setSelectedIncident(incident); setConfirmOutcome('returned_to_work'); setConfirmNotes(''); setShowModal(true); }}
                          >
                            <Briefcase size={16} /> Back to Work
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => { setSelectedIncident(incident); setConfirmOutcome('referred_to_doctor'); setConfirmNotes(''); setShowModal(true); }}
                          >
                            <Stethoscope size={16} /> Send to Doctor
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── SECTION 2: Normal — awaiting on-site confirmation ── */}
          {normalPending.length > 0 && (
            <div>
              <h2 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Awaiting On-Site Confirmation
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {normalPending.map(incident => {
                  const sev = severityColors[incident.severity] || severityColors.minor;
                  return (
                    <div key={incident._id} className="card" style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 250 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)', fontSize: '0.9rem' }}>{incident.incidentId}</span>
                            <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                              {incident.severity?.toUpperCase()}
                            </span>
                            <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 500, background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
                              {incident.incidentType?.replace('_', ' ')}
                            </span>
                          </div>
                          <p style={{ margin: '0 0 10px', color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1.5 }}>
                            {incident.description?.substring(0, 150)}{incident.description?.length > 150 ? '...' : ''}
                          </p>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={14} /> {incident.injuredPerson?.name || 'Unknown'}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={14} /> {incident.location}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={14} /> {new Date(incident.dateTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-secondary" onClick={() => navigate(`/incidents/${incident._id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Eye size={16} /> View
                          </button>
                          <button className="btn btn-primary" onClick={() => openConfirmModal(incident)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Send size={16} /> Confirm &amp; Send
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Standard Confirmation Modal ─────────────────────────── */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ maxWidth: 520, width: '90%', padding: '32px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 4px', color: 'var(--text-main)', fontSize: '1.4rem' }}>
              {confirmOutcome ? 'Confirm Outcome Decision' : 'Confirm Incident'}
            </h2>
            <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {confirmOutcome === 'returned_to_work' 
                ? <>You are confirming that <strong>{selectedIncident?.injuredPerson?.name || selectedIncident?.incidentId}</strong> can safely <strong>return to work</strong>. This will resolve the incident.</>
                : confirmOutcome === 'referred_to_doctor'
                  ? <>You are referring <strong>{selectedIncident?.injuredPerson?.name || selectedIncident?.incidentId}</strong> to the <strong>doctor</strong>. The doctor will be notified to add treatment details.</>
                  : <>Add your on-site observations for <strong>{selectedIncident?.incidentId}</strong>. This will be forwarded to the Doctor for review.</>
              }
            </p>

            {/* Show chosen outcome badge */}
            {confirmOutcome && (
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                background: confirmOutcome === 'returned_to_work' ? 'rgba(16,185,129,0.08)' : 'rgba(99,102,241,0.08)',
                border: `1px solid ${confirmOutcome === 'returned_to_work' ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.25)'}`
              }}>
                {confirmOutcome === 'returned_to_work' 
                  ? <Briefcase size={18} color="#10B981" />
                  : <Stethoscope size={18} color="#6366f1" />
                }
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: confirmOutcome === 'returned_to_work' ? '#10B981' : '#6366f1' }}>
                  {confirmOutcome === 'returned_to_work' ? 'Worker will return to work' : 'Worker will be sent to doctor'}
                </span>
              </div>
            )}

            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-main)', fontSize: '0.9rem' }}>On-Site Notes &amp; Observations</label>
            <textarea
              value={confirmNotes}
              onChange={e => setConfirmNotes(e.target.value)}
              placeholder="Describe what you observed on-site, items used, condition of the affected person..."
              rows={5}
              style={{ width: '100%', marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setShowModal(false); setConfirmOutcome(''); }}>Cancel</button>
              <button 
                className="btn" 
                style={{ 
                  background: confirmOutcome === 'returned_to_work' ? '#10B981' : 'var(--blue-600)', 
                  color: '#fff', display: 'flex', alignItems: 'center', gap: 6 
                }}
                onClick={handleConfirm} 
                disabled={confirmingId}
              >
                {confirmingId 
                  ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span> 
                  : confirmOutcome === 'returned_to_work'
                    ? <><Briefcase size={16} /> Confirm — Back to Work</>
                    : <><Send size={16} /> Confirm &amp; Forward to Doctor</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
