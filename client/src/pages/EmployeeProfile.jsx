import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getEmployeeProfile, updateEmployeeProfile, downloadQr,
  regenerateQr, uploadProfilePhoto, getEmployeeScanHistory,
  getMedicalProfile, getEmployeeTreatments
} from '../services/api';
import {
  ArrowLeft, User, Building2, Shield, Droplets, Phone, Award,
  QrCode, Download, RefreshCw, CreditCard, Camera, Edit3, X,
  Calendar, Mail, Hash, MapPin, Clock, AlertTriangle, Stethoscope, FileText, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import './EmployeeProfile.css';

const EmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, hasRole, t } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editSection, setEditSection] = useState('');
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const [medicalProfile, setMedicalProfile] = useState(null);
  const [treatments, setTreatments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  const isSelf = currentUser?._id === id;
  const isAdmin = hasRole('doctor', 'manager');

  useEffect(() => {
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const [profileRes, scanRes, medRes, trtRes, rxRes] = await Promise.all([
        getEmployeeProfile(id),
        getEmployeeScanHistory(id).catch(() => ({ data: { data: [] } })),
        getMedicalProfile(id).catch(() => ({ data: { data: null } })),
        getEmployeeTreatments(id).catch(() => ({ data: { data: [] } })),
        getActivePrescriptions(id).catch(() => ({ data: { data: [] } }))
      ]);
      setEmployee(profileRes.data.data);
      setScanHistory(scanRes.data.data || []);
      setMedicalProfile(medRes.data.data);
      setTreatments(trtRes.data.data || []);
      setPrescriptions(rxRes.data.data || []);
    } catch (e) {
      toast.error('Failed to load profile');
      navigate('/employees');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await uploadProfilePhoto(id, formData);
      setEmployee(prev => ({ ...prev, profilePhoto: res.data.data.profilePhoto }));
      toast.success('Photo updated');
    } catch (err) {
      toast.error('Failed to upload photo');
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
      toast.success('QR downloaded');
    } catch (e) {
      toast.error('Failed to download QR');
    }
  };

  const handleRegenerateQr = async () => {
    if (!window.confirm('Are you sure? The current QR will be invalidated.')) return;
    try {
      const res = await regenerateQr(id);
      setEmployee(prev => ({
        ...prev,
        qrCodeData: res.data.data.qrCodeData,
        qrCodeId: res.data.data.qrCodeId,
        qrCodeGeneratedAt: res.data.data.qrCodeGeneratedAt
      }));
      toast.success('QR regenerated');
    } catch (e) {
      toast.error('Failed to regenerate QR');
    }
  };

  const openEdit = (section) => {
    if (!employee) return;
    let defaults = {};
    if (section === 'personal') {
      defaults = { phone: employee.phone || '', gender: employee.gender || '', dateOfBirth: employee.dateOfBirth?.split('T')[0] || '' };
    } else if (section === 'emergency') {
      defaults = {
        'emergencyContact.name': employee.emergencyContact?.name || '',
        'emergencyContact.phone': employee.emergencyContact?.phone || '',
        'emergencyContact.relationship': employee.emergencyContact?.relationship || ''
      };
    } else if (section === 'safety') {
      defaults = {
        bloodGroup: employee.bloodGroup || '',
        knownAllergies: (employee.knownAllergies || []).join(', '),
        chronicConditions: (employee.chronicConditions || []).join(', ')
      };
    } else if (section === 'organization') {
      defaults = {
        designation: employee.designation || '',
        department: employee.department?._id || '',
        dateOfJoining: employee.dateOfJoining?.split('T')[0] || '',
        employeeStatus: employee.employeeStatus || 'active'
      };
    }
    setEditForm(defaults);
    setEditSection(section);
    setShowEdit(true);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const data = { ...editForm };
      // Convert arrays
      if (data.knownAllergies && typeof data.knownAllergies === 'string') {
        data.knownAllergies = data.knownAllergies.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (data.chronicConditions && typeof data.chronicConditions === 'string') {
        data.chronicConditions = data.chronicConditions.split(',').map(s => s.trim()).filter(Boolean);
      }
      // Convert nested emergency contact
      if (data['emergencyContact.name'] !== undefined) {
        data.emergencyContact = {
          name: data['emergencyContact.name'],
          phone: data['emergencyContact.phone'],
          relationship: data['emergencyContact.relationship']
        };
        delete data['emergencyContact.name'];
        delete data['emergencyContact.phone'];
        delete data['emergencyContact.relationship'];
      }
      await updateEmployeeProfile(id, data);
      toast.success('Profile updated');
      setShowEdit(false);
      loadProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-loader"><div className="spinner"></div></div>;
  }
  if (!employee) return null;

  const status = employee.employeeStatus || (employee.isActive ? 'active' : 'resigned');

  return (
    <div className="profile-page">
      {/* Header Card */}
      <div className="profile-header-card">
        <div className="profile-photo-container">
          {employee.profilePhoto ? (
            <img src={employee.profilePhoto} alt={employee.name} className="profile-photo" />
          ) : (
            <div className="profile-photo-placeholder">
              {employee.name?.charAt(0)?.toUpperCase()}
            </div>
          )}
          {(isSelf || isAdmin) && (
            <label className="profile-photo-upload">
              <Camera size={14} />
              <input type="file" accept="image/*" onChange={handlePhotoUpload} />
            </label>
          )}
        </div>

        <div className="profile-header-info">
          <div className="profile-name">{employee.name}</div>
          <div className="profile-emp-id">{employee.employeeId}</div>
          <span className={`profile-status-badge ${status}`}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
            {t(`employee.status.${status}`) || status.replace('_', ' ')}
          </span>
        </div>

        <div className="profile-header-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/employees/${id}/card`)}>
            <CreditCard size={16} /> {t('employee.viewCard')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>

      <div className="profile-tabs">
        <button className={`profile-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <User size={16} /> Overview
        </button>
        <button className={`profile-tab ${activeTab === 'medical' ? 'active' : ''}`} onClick={() => setActiveTab('medical')}>
          <Activity size={16} /> Medical Profile
        </button>
        <button className={`profile-tab ${activeTab === 'treatments' ? 'active' : ''}`} onClick={() => setActiveTab('treatments')}>
          <Stethoscope size={16} /> Treatments ({treatments.length})
        </button>
        <button className={`profile-tab ${activeTab === 'prescriptions' ? 'active' : ''}`} onClick={() => setActiveTab('prescriptions')}>
          <FileText size={16} /> Active Prescriptions ({prescriptions.length})
        </button>
      </div>

      {/* Profile Sections Grid */}
      <div className="profile-sections">
        {activeTab === 'overview' && (
          <>
            {/* Personal Info */}
        <div className="profile-section">
          <div className="profile-section-title">
            <User size={16} /> {t('employee.personalInfo')}
            {(isSelf || isAdmin) && (
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', padding: '4px 10px' }} onClick={() => openEdit('personal')}>
                <Edit3 size={13} />
              </button>
            )}
          </div>
          <div className="profile-info-grid">
            <div className="profile-info-item">
              <span className="profile-info-label">Full Name</span>
              <span className="profile-info-value">{employee.name}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Email</span>
              <span className="profile-info-value">{employee.email}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Phone</span>
              <span className="profile-info-value">{employee.phone || <span className="muted">Not set</span>}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Gender</span>
              <span className="profile-info-value">{employee.gender ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1) : <span className="muted">Not set</span>}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Date of Birth</span>
              <span className="profile-info-value">{employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString('en-IN') : <span className="muted">Not set</span>}</span>
            </div>
          </div>
        </div>

        {/* Organization Info */}
        <div className="profile-section">
          <div className="profile-section-title">
            <Building2 size={16} /> {t('employee.orgInfo')}
            {isAdmin && (
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', padding: '4px 10px' }} onClick={() => openEdit('organization')}>
                <Edit3 size={13} />
              </button>
            )}
          </div>
          <div className="profile-info-grid">
            <div className="profile-info-item">
              <span className="profile-info-label">Employee ID</span>
              <span className="profile-info-value" style={{ color: '#3b82f6', fontWeight: 600 }}>{employee.employeeId}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Department</span>
              <span className="profile-info-value">{employee.department?.name || <span className="muted">Not assigned</span>}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Designation</span>
              <span className="profile-info-value">{employee.designation || <span className="muted">Not set</span>}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Joining Date</span>
              <span className="profile-info-value">{employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString('en-IN') : <span className="muted">Not set</span>}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Role</span>
              <span className="profile-info-value">{employee.role?.replace('_', ' ')}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Status</span>
              <span className={`profile-status-badge ${status}`} style={{ alignSelf: 'flex-start' }}>
                {t(`employee.status.${status}`) || status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Safety Info */}
        <div className="profile-section">
          <div className="profile-section-title">
            <Droplets size={16} /> {t('employee.safetyInfo')}
            {(isSelf || isAdmin) && (
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', padding: '4px 10px' }} onClick={() => openEdit('safety')}>
                <Edit3 size={13} />
              </button>
            )}
          </div>
          <div className="profile-info-grid">
            <div className="profile-info-item">
              <span className="profile-info-label">Blood Group</span>
              <span className="profile-info-value">{employee.bloodGroup ? <span className="blood-group-badge"><Droplets size={12} /> {employee.bloodGroup}</span> : <span className="muted">Not set</span>}</span>
            </div>
            <div className="profile-info-item" style={{ gridColumn: '1 / -1' }}>
              <span className="profile-info-label">Known Allergies</span>
              {employee.knownAllergies?.length > 0 ? (
                <div className="tag-list">
                  {employee.knownAllergies.map((a, i) => <span key={i} className="tag-item">{a}</span>)}
                </div>
              ) : (
                <span className="profile-info-value muted">None recorded</span>
              )}
            </div>
            <div className="profile-info-item" style={{ gridColumn: '1 / -1' }}>
              <span className="profile-info-label">Chronic Conditions</span>
              {employee.chronicConditions?.length > 0 ? (
                <div className="tag-list">
                  {employee.chronicConditions.map((c, i) => <span key={i} className="tag-item" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>{c}</span>)}
                </div>
              ) : (
                <span className="profile-info-value muted">None recorded</span>
              )}
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="profile-section">
          <div className="profile-section-title">
            <Phone size={16} /> {t('employee.emergencyContact')}
            {(isSelf || isAdmin) && (
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', padding: '4px 10px' }} onClick={() => openEdit('emergency')}>
                <Edit3 size={13} />
              </button>
            )}
          </div>
          <div className="profile-info-grid">
            <div className="profile-info-item">
              <span className="profile-info-label">Contact Name</span>
              <span className="profile-info-value">{employee.emergencyContact?.name || <span className="muted">Not set</span>}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Phone Number</span>
              <span className="profile-info-value">{employee.emergencyContact?.phone || <span className="muted">Not set</span>}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Relationship</span>
              <span className="profile-info-value">{employee.emergencyContact?.relationship || <span className="muted">Not set</span>}</span>
            </div>
          </div>
        </div>

        {/* First Aid Info */}
        <div className="profile-section">
          <div className="profile-section-title">
            <Award size={16} /> {t('employee.firstAidInfo')}
          </div>
          <div className="profile-info-grid">
            <div className="profile-info-item">
              <span className="profile-info-label">Certification Status</span>
              <span className={`cert-badge ${employee.firstAidCertified ? 'certified' : 'not-certified'}`}>
                <Shield size={11} />
                {employee.firstAidCertified ? 'Certified' : 'Not Certified'}
              </span>
            </div>
            {employee.firstAidCertified && (
              <>
                <div className="profile-info-item">
                  <span className="profile-info-label">Certification Number</span>
                  <span className="profile-info-value">{employee.certificationNumber || '—'}</span>
                </div>
                <div className="profile-info-item">
                  <span className="profile-info-label">Expiry Date</span>
                  <span className="profile-info-value">{employee.certificationExpiry ? new Date(employee.certificationExpiry).toLocaleDateString('en-IN') : '—'}</span>
                </div>
              </>
            )}
            <div className="profile-info-item">
              <span className="profile-info-label">Training Status</span>
              <span className="profile-info-value">{(employee.firstAidTrainingStatus || 'not_trained').replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* QR Information */}
        <div className="profile-section">
          <div className="profile-section-title">
            <QrCode size={16} /> {t('employee.qrInfo')}
          </div>
          <div className="profile-qr-area">
            <div className="profile-qr-preview">
              {employee.qrCodeData ? (
                <img src={employee.qrCodeData} alt="QR Code" />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.75rem' }}>No QR</div>
              )}
            </div>
            <div className="profile-qr-details">
              <p><strong>QR ID:</strong> {employee.qrCodeId || '—'}</p>
              <p><strong>Generated:</strong> {employee.qrCodeGeneratedAt ? new Date(employee.qrCodeGeneratedAt).toLocaleDateString('en-IN') : '—'}</p>
              <p><strong>{t('employee.lastScan')}:</strong> {employee.lastQrScanAt ? new Date(employee.lastQrScanAt).toLocaleString('en-IN') : t('employee.noScans')}</p>
              <div className="profile-qr-actions">
                <button className="btn btn-primary btn-sm" onClick={handleDownloadQr}>
                  <Download size={14} /> {t('employee.downloadQr')}
                </button>
                {isAdmin && (
                  <button className="btn btn-warning btn-sm" onClick={handleRegenerateQr}>
                    <RefreshCw size={14} /> {t('employee.regenerateQr')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

          </>
        )}

        {activeTab === 'medical' && (
          <div className="profile-section full-width">
            <div className="profile-section-title"><Activity size={16} /> Comprehensive Medical Profile</div>
            {medicalProfile ? (
              <div className="profile-info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="profile-info-item"><span className="profile-info-label">Blood Group</span><span className="profile-info-value">{medicalProfile.bloodGroup || '—'}</span></div>
                <div className="profile-info-item"><span className="profile-info-label">Height (cm)</span><span className="profile-info-value">{medicalProfile.physicalAttributes?.height || '—'}</span></div>
                <div className="profile-info-item"><span className="profile-info-label">Weight (kg)</span><span className="profile-info-value">{medicalProfile.physicalAttributes?.weight || '—'}</span></div>
                <div className="profile-info-item"><span className="profile-info-label">Vision</span><span className="profile-info-value">{medicalProfile.physicalAttributes?.vision || '—'}</span></div>
                
                <div className="profile-info-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="profile-info-label">Allergies</span>
                  {medicalProfile.allergies?.length > 0 ? <div className="tag-list">{medicalProfile.allergies.map((a, i) => <span key={i} className="tag-item">{a}</span>)}</div> : <span className="muted">None recorded</span>}
                </div>
                
                <div className="profile-info-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="profile-info-label">Pre-existing Conditions</span>
                  {medicalProfile.preExistingConditions?.length > 0 ? <div className="tag-list">{medicalProfile.preExistingConditions.map((c, i) => <span key={i} className="tag-item" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>{c}</span>)}</div> : <span className="muted">None recorded</span>}
                </div>

                <div className="profile-info-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="profile-info-label">Current Medications</span>
                  {medicalProfile.currentMedications?.length > 0 ? <div className="tag-list">{medicalProfile.currentMedications.map((m, i) => <span key={i} className="tag-item" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{m}</span>)}</div> : <span className="muted">None recorded</span>}
                </div>

                <div className="profile-info-item" style={{ gridColumn: '1 / -1' }}><span className="profile-info-label">Notes</span><span className="profile-info-value">{medicalProfile.notes || '—'}</span></div>
              </div>
            ) : <div className="empty-state"><p>No enhanced medical profile exists for this employee.</p></div>}
          </div>
        )}

        {activeTab === 'treatments' && (
          <div className="profile-section full-width">
            <div className="profile-section-title"><Stethoscope size={16} /> Treatment History</div>
            {treatments.length > 0 ? (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead><tr><th>ID</th><th>Date</th><th>Injury</th><th>Severity</th><th>Treatment</th></tr></thead>
                  <tbody>
                    {treatments.map(t => (
                      <tr key={t._id} onClick={() => navigate(`/treatments/${t._id}`)} style={{ cursor: 'pointer' }}>
                        <td style={{ color: 'var(--blue-600)', fontWeight: 600 }}>{t.treatmentId}</td>
                        <td>{new Date(t.treatmentDate).toLocaleDateString()}</td>
                        <td>{t.injuryType}</td>
                        <td><span className={`badge badge-${t.injurySeverity}`}>{t.injurySeverity}</span></td>
                        <td>{t.treatmentProvided?.substring(0, 40)}...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state"><p>No treatments logged for this employee.</p></div>}
          </div>
        )}

        {activeTab === 'prescriptions' && (
          <div className="profile-section full-width">
            <div className="profile-section-title"><FileText size={16} /> Active Prescriptions</div>
            {prescriptions.length > 0 ? (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead><tr><th>Doctor</th><th>Date</th><th>Medicines</th><th>Status</th></tr></thead>
                  <tbody>
                    {prescriptions.map(p => (
                      <tr key={p._id}>
                        <td>{p.doctorName}</td>
                        <td>{new Date(p.issueDate).toLocaleDateString()}</td>
                        <td>{p.medicines?.length || 0} item(s)</td>
                        <td><span className="badge badge-green">{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state"><p>No active prescriptions.</p></div>}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit {editSection.charAt(0).toUpperCase() + editSection.slice(1)} Information</h3>
              <button className="modal-close" onClick={() => setShowEdit(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="edit-section-grid">
                {editSection === 'personal' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Gender</label>
                      <select value={editForm.gender || ''} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date of Birth</label>
                      <input type="date" value={editForm.dateOfBirth || ''} onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
                    </div>
                  </>
                )}

                {editSection === 'emergency' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Contact Name</label>
                      <input value={editForm['emergencyContact.name'] || ''} onChange={e => setEditForm(f => ({ ...f, 'emergencyContact.name': e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Contact Phone</label>
                      <input value={editForm['emergencyContact.phone'] || ''} onChange={e => setEditForm(f => ({ ...f, 'emergencyContact.phone': e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Relationship</label>
                      <input value={editForm['emergencyContact.relationship'] || ''} onChange={e => setEditForm(f => ({ ...f, 'emergencyContact.relationship': e.target.value }))} />
                    </div>
                  </>
                )}

                {editSection === 'safety' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Blood Group</label>
                      <select value={editForm.bloodGroup || ''} onChange={e => setEditForm(f => ({ ...f, bloodGroup: e.target.value }))}>
                        <option value="">Select</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Known Allergies (comma separated)</label>
                      <input value={editForm.knownAllergies || ''} onChange={e => setEditForm(f => ({ ...f, knownAllergies: e.target.value }))} placeholder="e.g. Penicillin, Peanuts" />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Chronic Conditions (comma separated)</label>
                      <input value={editForm.chronicConditions || ''} onChange={e => setEditForm(f => ({ ...f, chronicConditions: e.target.value }))} placeholder="e.g. Diabetes, Asthma" />
                    </div>
                  </>
                )}

                {editSection === 'organization' && isAdmin && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Designation</label>
                      <input value={editForm.designation || ''} onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select value={editForm.employeeStatus || ''} onChange={e => setEditForm(f => ({ ...f, employeeStatus: e.target.value }))}>
                        <option value="active">Active</option>
                        <option value="on_leave">On Leave</option>
                        <option value="suspended">Suspended</option>
                        <option value="resigned">Resigned</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Joining Date</label>
                      <input type="date" value={editForm.dateOfJoining || ''} onChange={e => setEditForm(f => ({ ...f, dateOfJoining: e.target.value }))} />
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowEdit(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeProfile;
