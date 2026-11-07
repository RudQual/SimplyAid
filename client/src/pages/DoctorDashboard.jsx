import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Stethoscope, ClipboardCheck, Clock, MapPin, User, CheckCircle2, Activity, Eye } from 'lucide-react';
import useAsync from '../hooks/useAsync';
import { getIncidents, getIncidentStats, doctorReviewIncident } from '../services/api';
import { PageHeader, StatCard, StatusBadge, EmptyState, ErrorState, SkeletonRows, Modal, Field, Spinner, Tabs } from '../components/ui';
import { formatDateTime, labelize, errorMessage, timeAgo } from '../utils/format';

/** Medical review queue: incidents confirmed by managers and referred to a doctor. */
const DoctorDashboard = () => {
  const [tab, setTab] = useState('pending');
  const [reviewing, setReviewing] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useAsync(() => getIncidents({ forwardedToDoctor: true, status: 'under_investigation', limit: 50 }), []);
  const recent = useAsync(() => getIncidents({ status: 'resolved', limit: 20 }), []);
  const stats = useAsync(() => getIncidentStats({ period: 30 }), [], { select: (r) => r.data.data.summary });

  const submit = async () => {
    setBusy(true);
    try {
      const res = await doctorReviewIncident(reviewing._id, { notes: notes.trim() });
      toast.success(res.data.message);
      if (res.data.warning) toast(res.data.warning, { icon: '⚠️', duration: 6000 });
      setReviewing(null);
      pending.refresh(); recent.refresh(); stats.refresh();
    } catch (err) {
      toast.error(errorMessage(err, 'Review failed'));
    } finally {
      setBusy(false);
    }
  };

  const list = tab === 'pending' ? pending : recent;
  const rows = list.data?.data || [];
  const s = stats.data;

  return (
    <div className="page-content">
      <PageHeader title="Medical review queue" subtitle="Incidents confirmed on-site by managers and referred for medical review." />
      <div className="stat-grid">
        <StatCard label="Awaiting review" value={pending.data?.total ?? '—'} icon={ClipboardCheck} tone="red" loading={pending.loading} />
        <StatCard label="Incidents (30 days)" value={s?.total ?? '—'} icon={Activity} tone="blue" loading={stats.loading} />
        <StatCard label="Open cases" value={s?.openCases ?? '—'} icon={Clock} tone="amber" loading={stats.loading} />
        <StatCard label="Days lost (30 days)" value={s?.totalDaysLost ?? '—'} icon={CheckCircle2} tone="violet" loading={stats.loading} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pending', label: 'Awaiting review', count: pending.data?.total }, { value: 'recent', label: 'Recently resolved' }]} />
      <div className="card card-flush">
        {list.loading && !list.data && <SkeletonRows rows={5} cols={3} />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data && rows.length === 0 && <EmptyState icon={ClipboardCheck} title={tab === 'pending' ? 'No incidents awaiting review' : 'Nothing resolved recently'} description={tab === 'pending' ? 'Manager-confirmed referrals will appear here.' : ''} />}
        <div className="list">
          {rows.map((i) => (
            <div key={i._id} className="list-item" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div className="list-item-main" style={{ minWidth: 260 }}>
                <div className="row wrap" style={{ gap: 8, marginBottom: 4 }}>
                  <span className="mono strong">{i.incidentId}</span>
                  <StatusBadge value={i.severity} />
                  {i.managerConfirmation?.confirmedAt && <span className="badge badge-teal">Confirmed by {i.managerConfirmation.confirmedBy?.name || 'manager'}</span>}
                </div>
                <p className="small" style={{ margin: '4px 0 6px' }}>{i.description}</p>
                {i.managerConfirmation?.notes && <div className="alert alert-info" style={{ padding: '6px 10px', marginBottom: 6 }}><span className="small"><strong>Manager notes:</strong> {i.managerConfirmation.notes}</span></div>}
                <div className="row wrap small muted" style={{ gap: 14 }}>
                  <span className="row" style={{ gap: 4 }}><User size={13} /> {i.injuredPerson?.name}</span>
                  <span className="row" style={{ gap: 4 }}><MapPin size={13} /> {i.location}</span>
                  <span className="row" style={{ gap: 4 }}><Clock size={13} /> {formatDateTime(i.dateTime)} ({timeAgo(i.dateTime)})</span>
                  <span>{labelize(i.outcome)}</span>
                </div>
              </div>
              <div className="row">
                <Link to={`/incidents/${i._id}`} className="btn btn-secondary btn-sm"><Eye size={14} /> Details</Link>
                {tab === 'pending' && <button className="btn btn-primary btn-sm" onClick={() => { setReviewing(i); setNotes(''); }}><Stethoscope size={14} /> Review</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={Boolean(reviewing)} onClose={() => setReviewing(null)} busy={busy} title={`Medical review — ${reviewing?.incidentId}`}
        description="Your assessment is added to the incident record and the incident is marked resolved."
        footer={<><button className="btn btn-secondary" onClick={() => setReviewing(null)}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? <Spinner size="sm" light /> : <><CheckCircle2 size={15} /> Resolve incident</>}</button></>}>
        <Field label="Assessment & notes" hint="Diagnosis, treatment, follow-up, fitness to return to work."><textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} autoFocus /></Field>
      </Modal>
    </div>
  );
};

export default DoctorDashboard;
