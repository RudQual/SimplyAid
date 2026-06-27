import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getEmployeeCardData, regenerateQr, downloadQr } from '../services/api';
import { ArrowLeft, Download, RefreshCw, Printer, Heart, Droplets, Phone, Shield, Award, RotateCcw, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import './EmployeeIdCard.css';

const EmployeeIdCard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, hasRole, t } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    loadCard();
  }, [id]);

  const loadCard = async () => {
    try {
      setLoading(true);
      const res = await getEmployeeCardData(id);
      setEmployee(res.data.data);
    } catch (e) {
      toast.error('Failed to load employee card');
      navigate('/employees');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQr = async () => {
    try {
      const res = await downloadQr(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR-${employee.employeeId}.png`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('QR code downloaded');
    } catch (e) {
      toast.error('Failed to download QR');
    }
  };

  const handleRegenerateQr = async () => {
    if (!window.confirm('Are you sure? This will invalidate the current QR code.')) return;
    try {
      setRegenerating(true);
      const res = await regenerateQr(id);
      setEmployee(prev => ({
        ...prev,
        qrCodeData: res.data.data.qrCodeData,
        qrCodeId: res.data.data.qrCodeId,
        qrCodeGeneratedAt: res.data.data.qrCodeGeneratedAt
      }));
      toast.success('QR code regenerated');
    } catch (e) {
      toast.error('Failed to regenerate QR');
    } finally {
      setRegenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Capture front
      setFlipped(false);
      await new Promise(r => setTimeout(r, 400));
      const frontCanvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true
      });

      // Capture back
      setFlipped(true);
      await new Promise(r => setTimeout(r, 900));
      const backCanvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true
      });

      setFlipped(false);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [90, 130]
      });

      const frontImg = frontCanvas.toDataURL('image/png');
      const backImg = backCanvas.toDataURL('image/png');

      pdf.addImage(frontImg, 'PNG', 2, 2, 86, 126);
      pdf.addPage([90, 130], 'portrait');
      pdf.addImage(backImg, 'PNG', 2, 2, 86, 126);

      pdf.save(`IDCard-${employee.employeeId}.pdf`);
      toast.success('Card PDF downloaded');
    } catch (e) {
      toast.error('Failed to generate PDF');
      console.error(e);
    }
  };

  if (loading) {
    return <div className="page-loader"><div className="spinner"></div></div>;
  }

  if (!employee) return null;

  const status = employee.employeeStatus || (employee.isActive ? 'active' : 'resigned');

  return (
    <div className="id-card-page">
      {/* Action Bar */}
      <div className="id-card-actions-bar">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back
        </button>
        <div className="actions-group">
          <button className="btn btn-ghost btn-sm" onClick={handleDownloadQr}>
            <Download size={16} /> {t('employee.downloadQr')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleDownloadPdf}>
            <CreditCard size={16} /> {t('employee.downloadCard')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handlePrint}>
            <Printer size={16} /> {t('employee.printCard')}
          </button>
          {hasRole('doctor', 'manager') && (
            <button className="btn btn-warning btn-sm" onClick={handleRegenerateQr} disabled={regenerating}>
              <RefreshCw size={16} className={regenerating ? 'spinning' : ''} /> {t('employee.regenerateQr')}
            </button>
          )}
        </div>
      </div>

      {/* Card Scene */}
      <div className="id-card-scene">
        <div
          ref={cardRef}
          className={`id-card-container ${flipped ? 'flipped' : ''}`}
          onClick={() => setFlipped(f => !f)}
        >
          {/* ======= FRONT ======= */}
          <div className="id-card-face id-card-front">
            <div className="card-front-accent" />
            <div className="card-front-header">
              <div className="card-company-logo">
                <Heart size={18} />
              </div>
              <div>
                <div className="card-company-name">
                  {employee.company?.name || 'SimplyAID'}
                </div>
                <div className="card-company-tag">Employee Identity Card</div>
              </div>
            </div>

            <div className="card-front-photo-area">
              {employee.profilePhoto ? (
                <img src={employee.profilePhoto} alt={employee.name} className="card-photo" />
              ) : (
                <div className="card-photo-placeholder">
                  {employee.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div className={`card-status-dot ${status}`} title={status} />
            </div>

            <div className="card-front-info">
              <div className="card-emp-name">{employee.name}</div>
              <div className="card-emp-id">{employee.employeeId}</div>
            </div>

            <div className="card-details-grid">
              <div className="card-detail-item">
                <div className="card-detail-label">Department</div>
                <div className="card-detail-value">{employee.department?.name || '—'}</div>
              </div>
              <div className="card-detail-item">
                <div className="card-detail-label">Designation</div>
                <div className="card-detail-value">{employee.designation || '—'}</div>
              </div>
              <div className="card-detail-item">
                <div className="card-detail-label">Role</div>
                <div className="card-detail-value">{employee.role?.replace('_', ' ') || '—'}</div>
              </div>
              <div className="card-detail-item">
                <div className="card-detail-label">Joined</div>
                <div className="card-detail-value">
                  {employee.dateOfJoining
                    ? new Date(employee.dateOfJoining).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                    : '—'}
                </div>
              </div>
            </div>

            <div className="card-front-qr">
              <div className="card-qr-img">
                {employee.qrCodeData ? (
                  <img src={employee.qrCodeData} alt="QR Code" />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.7rem' }}>No QR</div>
                )}
              </div>
              <div className="card-qr-text">
                <p className="qr-scan-label">Scan for Verification</p>
                <p>Scan this QR code to verify employee identity and access profile</p>
              </div>
            </div>
          </div>

          {/* ======= BACK ======= */}
          <div className="id-card-face id-card-back id-card-back-face">
            <div className="card-back-accent" />
            <div className="card-back-content">
              {/* Blood Group & Safety */}
              <div className="card-back-section">
                <div className="card-back-section-title">
                  <Droplets size={13} /> Medical Information
                </div>
                <div className="card-back-row">
                  <span className="card-back-label">Blood Group</span>
                  <span className="blood-group-badge">
                    <Droplets size={12} />
                    {employee.bloodGroup || '—'}
                  </span>
                </div>
                {employee.knownAllergies?.length > 0 && (
                  <div className="card-back-row" style={{ marginTop: 6 }}>
                    <span className="card-back-label">Allergies</span>
                    <span className="card-back-value" style={{ fontSize: '0.78rem' }}>
                      {employee.knownAllergies.join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Emergency Contact */}
              <div className="card-back-section">
                <div className="card-back-section-title">
                  <Phone size={13} /> Emergency Contact
                </div>
                <div className="card-back-row">
                  <span className="card-back-label">Name</span>
                  <span className="card-back-value">{employee.emergencyContact?.name || '—'}</span>
                </div>
                <div className="card-back-row">
                  <span className="card-back-label">Phone</span>
                  <span className="card-back-value">{employee.emergencyContact?.phone || '—'}</span>
                </div>
                <div className="card-back-row">
                  <span className="card-back-label">Relationship</span>
                  <span className="card-back-value">{employee.emergencyContact?.relationship || '—'}</span>
                </div>
              </div>

              {/* First Aid Certification */}
              <div className="card-back-section">
                <div className="card-back-section-title">
                  <Award size={13} /> First Aid Certification
                </div>
                <div className="card-back-row">
                  <span className="card-back-label">Status</span>
                  <span className={`cert-badge ${employee.firstAidCertified ? 'certified' : 'not-certified'}`}>
                    <Shield size={11} />
                    {employee.firstAidCertified ? 'Certified' : 'Not Certified'}
                  </span>
                </div>
                {employee.firstAidCertified && employee.certificationExpiry && (
                  <div className="card-back-row">
                    <span className="card-back-label">Expires</span>
                    <span className="card-back-value">
                      {new Date(employee.certificationExpiry).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="card-back-footer">
              <div className="company-text">{employee.company?.name || 'SimplyAID'}</div>
              <div className="validity-text">
                Status: <span className={status === 'active' || status === 'on_leave' ? 'validity-active' : 'validity-inactive'}>
                  {status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flip-hint">
        <RotateCcw size={14} /> Click card to flip
      </div>
    </div>
  );
};

export default EmployeeIdCard;
