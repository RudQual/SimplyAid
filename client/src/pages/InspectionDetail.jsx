import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Boxes, AlertTriangle } from 'lucide-react';
import useAsync from '../hooks/useAsync';
import { getInspection, resolveDeficiency } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Card, StatusBadge, ScoreRing, PageLoader, ErrorState, EmptyState } from '../components/ui';
import { formatDateTime, labelize, errorMessage } from '../utils/format';

const InspectionDetail = () => {
  const { id } = useParams();
  const { can } = useAuth();
  const ins = useAsync(() => getInspection(id), [id], { select: (r) => r.data.data });

  if (ins.loading && !ins.data) return <PageLoader />;
  if (ins.error) return <div className="page-content"><div className="card"><ErrorState error={ins.error} onRetry={ins.reload} /></div></div>;
  const r = ins.data;

  const resolve = async (defId) => {
    try { const res = await resolveDeficiency(r._id, defId); toast.success(res.data.message); ins.setData(res.data.data); } catch (err) { toast.error(errorMessage(err)); }
  };
  const ok = r.checklist.filter((c) => c.checked).length;

  return (
    <div className="page-content" style={{ maxWidth: 1100 }}>
      <PageHeader
        back={{ to: '/inspections', label: 'Inspections' }}
        title={<span className="row wrap" style={{ gap: 12 }}>{r.inspectionId} <StatusBadge value={r.status} size="lg" /></span>}
        subtitle={`${formatDateTime(r.inspectionDate)} · by ${r.inspector?.name || r.inspectorName}`}
        actions={r.firstAidBox && <Link to={`/kits/${r.firstAidBox._id}`} className="btn btn-secondary"><Boxes size={15} /> Open kit {r.firstAidBox.boxId}</Link>}
      />
      <div className="grid-main-side">
        <div className="stack">
          <Card title="Checklist" subtitle={`${ok} of ${r.checklist.length} items OK`} flush>
            {r.checklist.length === 0 ? <EmptyState title="No checklist recorded" /> : (
              <div className="list">
                {r.checklist.map((c) => (
                  <div key={c.itemName} className="list-item">
                    {c.checked ? <CheckCircle2 size={17} className="text-green" /> : <XCircle size={17} className="text-red" />}
                    <div className="list-item-main"><div className="list-item-title">{c.itemName}</div>{c.notes && <div className="list-item-sub">{c.notes}</div>}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Deficiencies" flush>
            {r.deficiencies.length === 0 ? <EmptyState icon={CheckCircle2} title="No deficiencies recorded" /> : (
              <div className="list">
                {r.deficiencies.map((d) => (
                  <div key={d._id} className="list-item">
                    <span className={`list-icon ${d.resolved ? 'tone-green' : 'tone-amber'}`}>{d.resolved ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}</span>
                    <div className="list-item-main">
                      <div className="list-item-title" style={{ whiteSpace: 'normal' }}>{d.description}</div>
                      <div className="list-item-sub">{labelize(d.severity)}{d.resolved ? ` · resolved ${formatDateTime(d.resolvedAt)} by ${d.resolvedBy?.name || '—'}` : ' · open'}</div>
                    </div>
                    {!d.resolved && can('inspect') && <button className="btn btn-secondary btn-sm" onClick={() => resolve(d._id)}>Mark resolved</button>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        <div className="stack">
          {r.complianceScore !== undefined && r.complianceScore !== null && (
            <Card title="Kit compliance at inspection">
              <div style={{ display: 'grid', placeItems: 'center', gap: 8 }}>
                <ScoreRing score={r.complianceScore} />
                <StatusBadge value={r.complianceStatus} />
              </div>
              {r.findings && (
                <div className="grid-2" style={{ gap: 10, marginTop: 16 }}>
                  <div className="mini-stat"><div className="label">Missing items</div><div className="value">{r.findings.missingItems}</div></div>
                  <div className="mini-stat"><div className="label">Below required</div><div className="value">{r.findings.lowStockItems}</div></div>
                  <div className="mini-stat"><div className="label">Expired units</div><div className="value">{r.findings.expiredUnits}</div></div>
                  <div className="mini-stat"><div className="label">Expiring ≤ 30d</div><div className="value">{r.findings.expiringSoonUnits}</div></div>
                </div>
              )}
            </Card>
          )}
          <Card title="Kit">
            <div className="detail-list" style={{ gridTemplateColumns: '1fr' }}>
              <div className="detail-row"><span className="detail-label">Kit</span><span className="detail-value">{r.firstAidBox?.boxId} (Class {r.firstAidBox?.classType})</span></div>
              <div className="detail-row"><span className="detail-label">Location</span><span className="detail-value">{r.firstAidBox?.location}</span></div>
              <div className="detail-row"><span className="detail-label">Department</span><span className="detail-value">{r.firstAidBox?.department?.name || '—'}</span></div>
            </div>
          </Card>
          {r.overallNotes && <Card title="Inspector notes"><p className="small" style={{ whiteSpace: 'pre-wrap' }}>{r.overallNotes}</p></Card>}
        </div>
      </div>
    </div>
  );
};

export default InspectionDetail;
