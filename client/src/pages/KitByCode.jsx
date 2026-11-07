import { Navigate, useParams } from 'react-router-dom';
import { MapPin, UserRound, Phone, Boxes } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import useAsync from '../hooks/useAsync';
import { scanBoxQr } from '../services/api';
import { PageHeader, Card, StatusBadge, PageLoader, ErrorState, EmptyState } from '../components/ui';
import { formatDate } from '../utils/format';

/**
 * Landing page for a scanned kit QR (by kit code).
 * Staff are taken to the full kit page; everyone else sees what the kit contains.
 */
const KitByCode = () => {
  const { boxId } = useParams();
  const { can } = useAuth();
  const scan = useAsync(() => scanBoxQr(boxId), [boxId], { select: (r) => r.data.data });

  if (scan.loading) return <PageLoader />;
  if (scan.error) return <div className="page-content"><div className="card"><ErrorState error={scan.error} /></div></div>;
  const { box } = scan.data;
  if (can('manageInventory')) return <Navigate to={`/kits/${box._id}`} replace />;

  return (
    <div className="page-content" style={{ maxWidth: 820 }}>
      <PageHeader eyebrow="First aid kit" title={box.boxId} subtitle={`${box.department?.name || ''} · Class ${box.classType}`} />
      <Card className="mb-24">
        <div className="detail-list">
          <div className="detail-row"><span className="detail-label"><MapPin size={12} /> Location</span><span className="detail-value">{box.location}{box.floor ? ` · ${box.floor}` : ''}</span></div>
          <div className="detail-row"><span className="detail-label"><UserRound size={12} /> In charge</span><span className="detail-value">{box.inCharge?.name || 'Unassigned'}</span></div>
          {box.inCharge?.phone && <div className="detail-row"><span className="detail-label"><Phone size={12} /> Contact</span><span className="detail-value"><a href={`tel:${box.inCharge.phone}`}>{box.inCharge.phone}</a></span></div>}
          <div className="detail-row"><span className="detail-label">Last inspected</span><span className="detail-value">{formatDate(box.lastInspectionDate)}</span></div>
        </div>
      </Card>
      <Card title="What’s in this kit" flush icon={Boxes}>
        {box.items.length === 0 ? <EmptyState title="No items recorded" /> : (
          <div className="list">
            {box.items.map((i) => (
              <div key={i.item._id} className="list-item">
                <div className="list-item-main">
                  <div className="list-item-title">{i.item.name}</div>
                  <div className="list-item-sub">{i.currentQty} {i.item.unit} available{i.nearestExpiry ? ` · use before ${formatDate(i.nearestExpiry)}` : ''}</div>
                </div>
                {i.expiryStatus === 'expired' ? <StatusBadge value="expired" label="Do not use — expired" /> : <StatusBadge value={i.stockStatus} />}
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="small muted mt-16">If something is missing or expired, tell the person in charge or report it as an incident.</p>
    </div>
  );
};

export default KitByCode;
