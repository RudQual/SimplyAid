import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMyProfile, updateMyProfile, uploadProfilePhoto } from '../services/api';
import toast from 'react-hot-toast';
import { CheckCircle, AlertTriangle, Edit2, Save, X, Camera, User, Briefcase, HeartPulse, Shield, UserCheck } from 'lucide-react';
import './MyProfile.css';

const MyProfile = () => {
  const { user, refreshUser, hasRole } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Edit states for 4 sections
  const [editMode, setEditMode] = useState({
    personal: false,
    employment: false,
    medical: false,
    safety: false
  });
  
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await getMyProfile();
      setProfile(res.data.data);
      initializeFormData(res.data.data);
    } catch (err) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const initializeFormData = (data) => {
    setFormData({
      name: data.name || '',
      gender: data.gender || '',
      dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '',
      bloodGroup: data.bloodGroup || '',
      phone: data.phone || '',
      emergencyContactName: data.emergencyContact?.name || '',
      emergencyContactPhone: data.emergencyContact?.phone || '',
      emergencyContactRelation: data.emergencyContact?.relationship || '',
      
      employeeId: data.employeeId || '',
      department: data.department?._id || '',
      designation: data.designation || '',
      factoryLocation: data.factoryLocation || '',
      shiftTiming: data.shiftTiming || '',
      dateOfJoining: data.dateOfJoining ? data.dateOfJoining.split('T')[0] : '',
      reportingManager: data.reportingManager || '',
      
      knownAllergies: data.knownAllergies?.join(', ') || '',
      chronicConditions: data.chronicConditions?.join(', ') || '',
      currentMedications: data.currentMedications?.join(', ') || '',
      disabilityInfo: data.disabilityInfo || '',
      
      firstAidTrainingStatus: data.firstAidTrainingStatus || 'not_trained',
      lastSafetyTrainingDate: data.lastSafetyTrainingDate ? data.lastSafetyTrainingDate.split('T')[0] : '',
      ppeAssigned: data.ppeAssigned?.join(', ') || '',
      safetyCertifications: data.safetyCertifications?.join(', ') || ''
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleEdit = (section) => {
    if (editMode[section]) {
      // Cancel edit -> reset data
      initializeFormData(profile);
    }
    setEditMode(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSave = async (section) => {
    try {
      const payload = {};
      
      if (section === 'personal') {
        payload.name = formData.name;
        payload.gender = formData.gender;
        payload.dateOfBirth = formData.dateOfBirth || null;
        payload.bloodGroup = formData.bloodGroup;
        payload.phone = formData.phone;
        payload.emergencyContact = {
          name: formData.emergencyContactName,
          phone: formData.emergencyContactPhone,
          relationship: formData.emergencyContactRelation
        };
      } else if (section === 'employment') {
        if (hasRole('admin')) {
          payload.employeeId = formData.employeeId;
          payload.department = formData.department;
        }
        payload.designation = formData.designation;
        payload.factoryLocation = formData.factoryLocation;
        payload.shiftTiming = formData.shiftTiming;
        payload.dateOfJoining = formData.dateOfJoining || null;
        payload.reportingManager = formData.reportingManager;
      } else if (section === 'medical') {
        // bloodGroup is also in medical but saved in personal, we can send it anyway
        payload.bloodGroup = formData.bloodGroup;
        payload.knownAllergies = formData.knownAllergies ? formData.knownAllergies.split(',').map(s => s.trim()) : [];
        payload.chronicConditions = formData.chronicConditions ? formData.chronicConditions.split(',').map(s => s.trim()) : [];
        payload.currentMedications = formData.currentMedications ? formData.currentMedications.split(',').map(s => s.trim()) : [];
        payload.disabilityInfo = formData.disabilityInfo;
      } else if (section === 'safety') {
        payload.firstAidTrainingStatus = formData.firstAidTrainingStatus;
        payload.lastSafetyTrainingDate = formData.lastSafetyTrainingDate || null;
        payload.ppeAssigned = formData.ppeAssigned ? formData.ppeAssigned.split(',').map(s => s.trim()) : [];
        payload.safetyCertifications = formData.safetyCertifications ? formData.safetyCertifications.split(',').map(s => s.trim()) : [];
      }

      const res = await updateMyProfile(payload);
      setProfile(res.data.data);
      initializeFormData(res.data.data);
      setEditMode(prev => ({ ...prev, [section]: false }));
      
      // Update global context so sidebar badge updates
      refreshUser();
      toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} information updated`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fd = new FormData();
    fd.append('photo', file);

    const toastId = toast.loading('Uploading photo...');
    try {
      const res = await uploadProfilePhoto(profile._id, fd);
      setProfile(prev => ({ ...prev, profilePhoto: res.data.data.profilePhoto }));
      refreshUser();
      toast.success('Photo updated successfully', { id: toastId });
    } catch (err) {
      toast.error('Failed to upload photo', { id: toastId });
    }
  };

  if (loading || !profile) return <div className="page-loader"><div className="spinner"></div></div>;

  const pct = profile.profileCompletionPercentage || 0;
  const isComplete = profile.profileCompleted;

  // Helper to check if a field is missing (empty string, null, undefined)
  const isMissing = (val) => !val || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0);

  const getSectionStatus = (fields) => {
    const missingCount = fields.filter(f => isMissing(formData[f])).length;
    if (missingCount === 0) return { complete: true, text: 'Complete', class: 'status-complete', icon: <CheckCircle size={14} /> };
    return { complete: false, text: `${missingCount} Missing`, class: 'status-incomplete', icon: <AlertTriangle size={14} /> };
  };

  const personalStatus = getSectionStatus(['name', 'dateOfBirth', 'gender', 'bloodGroup', 'phone', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation']);
  const employmentStatus = getSectionStatus(['employeeId', 'designation', 'factoryLocation', 'shiftTiming', 'dateOfJoining', 'reportingManager']); // ignoring department for simplicity if not loaded
  const medicalStatus = getSectionStatus(['bloodGroup', 'knownAllergies', 'chronicConditions', 'currentMedications']);
  const safetyStatus = getSectionStatus(['firstAidTrainingStatus', 'lastSafetyTrainingDate', 'ppeAssigned', 'safetyCertifications']);

  return (
    <div className="my-profile-page">
      {/* Header Card */}
      <div className="profile-header-card">
        <div className="profile-info-main">
          <div className="profile-photo-container">
            {profile.profilePhoto ? (
              <img src={profile.profilePhoto} alt="Profile" className="profile-photo" />
            ) : (
              <User size={48} color="var(--text-muted)" />
            )}
            <label className="profile-photo-upload-btn">
              <Camera size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Upload
              <input type="file" accept="image/jpeg, image/png, image/webp" style={{ display: 'none' }} onChange={handlePhotoUpload} />
            </label>
          </div>
          <div className="profile-details">
            <h1>{profile.name}</h1>
            <div className="profile-role">{profile.role?.replace('_', ' ')}</div>
            <div className="profile-id-badge">{profile.employeeId || 'ID Pending'}</div>
          </div>
        </div>

        <div className="profile-qr-section">
          {profile.qrCodeData ? (
            <img src={profile.qrCodeData} alt="QR Code" className="profile-qr-code" />
          ) : (
            <div className="profile-qr-code" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>No QR</span>
            </div>
          )}
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Your Identity QR</span>
        </div>
      </div>

      {/* Completion Banner */}
      <div className={`completion-banner ${isComplete ? 'complete' : pct < 50 ? 'critical' : 'incomplete'}`}>
        <div className="completion-progress-container">
          <div className="completion-header">
            <h3>Profile Completion</h3>
            <span className="completion-percentage" style={{ color: isComplete ? '#059669' : pct < 50 ? '#dc2626' : '#ea580c' }}>
              {pct}%
            </span>
          </div>
          <div className="progress-bar-bg">
            <div 
              className="progress-bar-fill" 
              style={{ 
                width: `${pct}%`, 
                backgroundColor: isComplete ? '#10B981' : pct < 50 ? '#DC2626' : '#F97316' 
              }}
            ></div>
          </div>
        </div>
        {!isComplete && (
          <div style={{ flexShrink: 0, color: pct < 50 ? '#dc2626' : '#ea580c', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 500 }}>
            <AlertTriangle size={18} />
            Please complete missing fields
          </div>
        )}
      </div>

      {/* Sections Grid */}
      <div className="profile-sections-grid">
        
        {/* Personal Info */}
        <div className={`profile-section-card ${!personalStatus.complete ? 'has-missing' : ''}`}>
          <div className="section-header">
            <h2 className="section-title"><UserCheck size={20} color="var(--accent)" /> Personal Info</h2>
            <div className={`section-status ${personalStatus.class}`}>
              {personalStatus.icon} {personalStatus.text}
            </div>
          </div>
          
          <div className="section-fields">
            <div className={`field-group ${isMissing(formData.name) ? 'missing-field' : ''}`}>
              <label>Full Name *</label>
              <input name="name" value={formData.name} onChange={handleChange} readOnly={!editMode.personal} />
              {isMissing(formData.name) && <span className="missing-label">Required</span>}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className={`field-group ${isMissing(formData.dateOfBirth) ? 'missing-field' : ''}`}>
                <label>Date of Birth *</label>
                <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} readOnly={!editMode.personal} />
              </div>
              <div className={`field-group ${isMissing(formData.gender) ? 'missing-field' : ''}`}>
                <label>Gender *</label>
                <select name="gender" value={formData.gender} onChange={handleChange} disabled={!editMode.personal}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className={`field-group ${isMissing(formData.phone) ? 'missing-field' : ''}`}>
              <label>Phone Number *</label>
              <input name="phone" value={formData.phone} onChange={handleChange} readOnly={!editMode.personal} />
            </div>

            <h4 style={{ margin: '16px 0 8px 0', fontSize: '1rem', color: 'var(--text-main)' }}>Emergency Contact</h4>
            <div className={`field-group ${isMissing(formData.emergencyContactName) ? 'missing-field' : ''}`}>
              <label>Contact Name *</label>
              <input name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} readOnly={!editMode.personal} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className={`field-group ${isMissing(formData.emergencyContactPhone) ? 'missing-field' : ''}`}>
                <label>Contact Phone *</label>
                <input name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} readOnly={!editMode.personal} />
              </div>
              <div className={`field-group ${isMissing(formData.emergencyContactRelation) ? 'missing-field' : ''}`}>
                <label>Relationship *</label>
                <input name="emergencyContactRelation" value={formData.emergencyContactRelation} onChange={handleChange} readOnly={!editMode.personal} />
              </div>
            </div>
          </div>

          <div className="section-actions">
            {editMode.personal ? (
              <>
                <button className="btn btn-ghost" onClick={() => toggleEdit('personal')}><X size={16} /> Cancel</button>
                <button className="btn btn-primary" onClick={() => handleSave('personal')}><Save size={16} /> Save</button>
              </>
            ) : (
              <button className="btn btn-outline" onClick={() => toggleEdit('personal')}><Edit2 size={16} /> Edit</button>
            )}
          </div>
        </div>

        {/* Employment Info */}
        <div className={`profile-section-card ${!employmentStatus.complete ? 'has-missing' : ''}`}>
          <div className="section-header">
            <h2 className="section-title"><Briefcase size={20} color="var(--accent)" /> Employment</h2>
            <div className={`section-status ${employmentStatus.class}`}>
              {employmentStatus.icon} {employmentStatus.text}
            </div>
          </div>
          
          <div className="section-fields">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className={`field-group ${isMissing(formData.employeeId) ? 'missing-field' : ''}`}>
                <label>Employee ID *</label>
                <input name="employeeId" value={formData.employeeId} onChange={handleChange} readOnly={!editMode.employment || !hasRole('admin')} title={!hasRole('admin') ? 'Only Admin can change ID' : ''} />
              </div>
              <div className={`field-group ${isMissing(formData.designation) ? 'missing-field' : ''}`}>
                <label>Designation *</label>
                <input name="designation" value={formData.designation} onChange={handleChange} readOnly={!editMode.employment} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className={`field-group ${isMissing(formData.factoryLocation) ? 'missing-field' : ''}`}>
                <label>Factory Location *</label>
                <input name="factoryLocation" value={formData.factoryLocation} onChange={handleChange} readOnly={!editMode.employment} />
              </div>
              <div className={`field-group ${isMissing(formData.shiftTiming) ? 'missing-field' : ''}`}>
                <label>Shift Timing *</label>
                <input name="shiftTiming" value={formData.shiftTiming} onChange={handleChange} readOnly={!editMode.employment} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className={`field-group ${isMissing(formData.dateOfJoining) ? 'missing-field' : ''}`}>
                <label>Date of Joining *</label>
                <input type="date" name="dateOfJoining" value={formData.dateOfJoining} onChange={handleChange} readOnly={!editMode.employment} />
              </div>
              <div className={`field-group ${isMissing(formData.reportingManager) ? 'missing-field' : ''}`}>
                <label>Reporting Manager *</label>
                <input name="reportingManager" value={formData.reportingManager} onChange={handleChange} readOnly={!editMode.employment} />
              </div>
            </div>
          </div>

          <div className="section-actions">
            {editMode.employment ? (
              <>
                <button className="btn btn-ghost" onClick={() => toggleEdit('employment')}><X size={16} /> Cancel</button>
                <button className="btn btn-primary" onClick={() => handleSave('employment')}><Save size={16} /> Save</button>
              </>
            ) : (
              <button className="btn btn-outline" onClick={() => toggleEdit('employment')}><Edit2 size={16} /> Edit</button>
            )}
          </div>
        </div>

        {/* Medical Info */}
        <div className={`profile-section-card ${!medicalStatus.complete ? 'has-missing' : ''}`}>
          <div className="section-header">
            <h2 className="section-title"><HeartPulse size={20} color="var(--accent)" /> Medical Info</h2>
            <div className={`section-status ${medicalStatus.class}`}>
              {medicalStatus.icon} {medicalStatus.text}
            </div>
          </div>
          
          <div className="section-fields">
            <div className={`field-group ${isMissing(formData.bloodGroup) ? 'missing-field' : ''}`}>
              <label>Blood Group *</label>
              <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} disabled={!editMode.medical && !editMode.personal}>
                <option value="">Select</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>
            
            <div className={`field-group ${isMissing(formData.knownAllergies) ? 'missing-field' : ''}`}>
              <label>Known Allergies (comma separated) *</label>
              <input name="knownAllergies" value={formData.knownAllergies} onChange={handleChange} readOnly={!editMode.medical} placeholder="e.g. Dust, Peanuts or 'None'" />
            </div>

            <div className={`field-group ${isMissing(formData.chronicConditions) ? 'missing-field' : ''}`}>
              <label>Chronic Conditions (comma separated) *</label>
              <input name="chronicConditions" value={formData.chronicConditions} onChange={handleChange} readOnly={!editMode.medical} placeholder="e.g. Asthma or 'None'" />
            </div>

            <div className={`field-group ${isMissing(formData.currentMedications) ? 'missing-field' : ''}`}>
              <label>Current Medications (comma separated) *</label>
              <input name="currentMedications" value={formData.currentMedications} onChange={handleChange} readOnly={!editMode.medical} placeholder="e.g. Inhaler or 'None'" />
            </div>

            <div className="field-group">
              <label>Disability Info (Optional)</label>
              <input name="disabilityInfo" value={formData.disabilityInfo} onChange={handleChange} readOnly={!editMode.medical} placeholder="Any disability requirements" />
            </div>
          </div>

          <div className="section-actions">
            {editMode.medical ? (
              <>
                <button className="btn btn-ghost" onClick={() => toggleEdit('medical')}><X size={16} /> Cancel</button>
                <button className="btn btn-primary" onClick={() => handleSave('medical')}><Save size={16} /> Save</button>
              </>
            ) : (
              <button className="btn btn-outline" onClick={() => toggleEdit('medical')}><Edit2 size={16} /> Edit</button>
            )}
          </div>
        </div>

        {/* Safety Info */}
        <div className={`profile-section-card ${!safetyStatus.complete ? 'has-missing' : ''}`}>
          <div className="section-header">
            <h2 className="section-title"><Shield size={20} color="var(--accent)" /> Safety Info</h2>
            <div className={`section-status ${safetyStatus.class}`}>
              {safetyStatus.icon} {safetyStatus.text}
            </div>
          </div>
          
          <div className="section-fields">
            <div className={`field-group ${isMissing(formData.firstAidTrainingStatus) ? 'missing-field' : ''}`}>
              <label>First Aid Training Status *</label>
              <select name="firstAidTrainingStatus" value={formData.firstAidTrainingStatus} onChange={handleChange} disabled={!editMode.safety}>
                <option value="not_trained">Not Trained</option>
                <option value="in_training">In Training</option>
                <option value="trained">Trained</option>
              </select>
            </div>

            <div className={`field-group ${isMissing(formData.lastSafetyTrainingDate) ? 'missing-field' : ''}`}>
              <label>Last Safety Training Date *</label>
              <input type="date" name="lastSafetyTrainingDate" value={formData.lastSafetyTrainingDate} onChange={handleChange} readOnly={!editMode.safety} />
            </div>

            <div className={`field-group ${isMissing(formData.ppeAssigned) ? 'missing-field' : ''}`}>
              <label>PPE Assigned (comma separated) *</label>
              <input name="ppeAssigned" value={formData.ppeAssigned} onChange={handleChange} readOnly={!editMode.safety} placeholder="e.g. Hard Hat, Safety Boots" />
            </div>

            <div className={`field-group ${isMissing(formData.safetyCertifications) ? 'missing-field' : ''}`}>
              <label>Safety Certifications (comma separated) *</label>
              <input name="safetyCertifications" value={formData.safetyCertifications} onChange={handleChange} readOnly={!editMode.safety} placeholder="e.g. Fire Safety, Confined Space" />
            </div>
          </div>

          <div className="section-actions">
            {editMode.safety ? (
              <>
                <button className="btn btn-ghost" onClick={() => toggleEdit('safety')}><X size={16} /> Cancel</button>
                <button className="btn btn-primary" onClick={() => handleSave('safety')}><Save size={16} /> Save</button>
              </>
            ) : (
              <button className="btn btn-outline" onClick={() => toggleEdit('safety')}><Edit2 size={16} /> Edit</button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default MyProfile;
