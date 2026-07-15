import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { validateQrScan, getMedicationOptions, createIncident } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useScanner } from '../contexts/ScannerContext';
import toast from 'react-hot-toast';
import { ScanLine, CheckCircle, XCircle, User, Briefcase, RefreshCw, ChevronLeft, Plus, X, Pill, MapPin, Package, Hash, FileText, AlertCircle, Camera, Upload, Trash2, ClipboardList, UserCheck, ArrowRight, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './QrScan.css';

const QrScan = () => {
  const { user } = useAuth();
  const { selectedScanner } = useScanner();
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();
  const qrCodeInstanceRef = useRef(null);

  // Scan Mode: 'camera' or 'file'
  const [scanMode, setScanMode] = useState('camera');
  const [cameraError, setCameraError] = useState(null);
  const [cameraStarting, setCameraStarting] = useState(false);

  // Post-scan action choice modal
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [delegating, setDelegating] = useState(false);

  // Medication Report State (Removed)
  const processingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let timer = null;

    if (scanning && scanMode === 'camera') {
      setCameraStarting(true);
      setCameraError(null);

      timer = setTimeout(async () => {
        if (!isMounted) return;
        const elem = document.getElementById("qr-reader");
        if (!elem) return;
        elem.innerHTML = "";

        try {
          const html5QrCode = new Html5Qrcode("qr-reader", {
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true
            }
          });
          qrCodeInstanceRef.current = html5QrCode;

          const scanConfig = {
            fps: 30,
            disableFlip: false,
            aspectRatio: 1.0,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const size = Math.floor(minEdge * 0.85);
              return { width: size, height: size };
            }
          };

          const onScanCallback = (decodedText) => {
            if (isMounted) onScanSuccess(decodedText);
          };

          try {
            await html5QrCode.start({ facingMode: "environment" }, scanConfig, onScanCallback, () => {});
          } catch (envErr) {
            // Fallback for laptop webcams without environment rear camera
            await html5QrCode.start({ facingMode: "user" }, scanConfig, onScanCallback, () => {});
          }

          if (isMounted) setCameraStarting(false);
        } catch (err) {
          console.error("Camera start error:", err);
          if (isMounted) {
            setCameraStarting(false);
            setCameraError("Camera permission denied or camera not accessible. Please switch to Image Upload.");
          }
        }
      }, 100);
    }

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      if (qrCodeInstanceRef.current) {
        const instance = qrCodeInstanceRef.current;
        qrCodeInstanceRef.current = null;
        if (instance.isScanning) {
          instance.stop().then(() => instance.clear()).catch(() => {});
        } else {
          try { instance.clear(); } catch(e) {}
        }
      }
    };
  }, [scanning, scanMode]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (processingRef.current) return;
    setProcessing(true);
    processingRef.current = true;

    try {
      const html5QrCode = new Html5Qrcode("file-qr-reader");
      const decodedText = await html5QrCode.scanFile(file, true);
      onScanSuccess(decodedText);
    } catch (err) {
      toast.error("Could not detect a valid QR code in the selected image.");
      processingRef.current = false;
      setProcessing(false);
    }
  };

  // When scan result arrives, show the action choice modal for all scans
  useEffect(() => {
    if (scanResult && user) {
      setShowChoiceModal(true);
    }
  }, [scanResult]);



  const onScanSuccess = async (decodedText) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    try {
      let payload;
      try {
        payload = JSON.parse(decodedText);
      } catch (e) {
        throw new Error('Scanned QR code is not in valid SimplyAID format.');
      }

      if (payload.type === 'first_aid_box' && payload.boxId) {
        toast.success(`First Aid Box ${payload.boxId} detected!`);
        navigate(`/inventory/boxes/scan/${payload.boxId}`);
        return;
      }

      const res = await validateQrScan(payload);
      
      setScanResult(res.data.data);
      setError(null);
      setScanning(false);
      toast.success(res.data.message || 'QR Validated');
      
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid QR Code format');
      setScanResult(null);
      setScanning(false);
      toast.error(err.response?.data?.message || err.message || 'Invalid QR Code');
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const onScanFailure = () => {};



  const resetScanner = () => {
    setScanResult(null);
    setError(null);
    setScanning(true);
    setShowChoiceModal(false);
  };

  const handleSelfReport = () => {
    setShowChoiceModal(false);
    navigate('/incidents/new', { state: { scannedUser: scanResult } });
  };

  const handleDelegateToManager = async () => {
    setDelegating(true);
    try {
      const deptId = scanResult.department?._id || scanResult.department || user?.department?._id || user?.department || undefined;
      const payload = {
        reportMode: 'manager_assisted',
        pendingManagerAssist: true,
        incidentType: 'illness',
        severity: 'minor',
        description: 'Employee was unable to file the incident report. Manager has been notified to visit on-site and complete this report.',
        location: selectedScanner?.location || 'Pending manager on-site assessment',
        outcome: 'under_observation',
        department: deptId,
        scanner: selectedScanner?._id || undefined,
        injuredPerson: {
          name: scanResult.name,
          employeeId: scanResult.employeeId,
          department: deptId,
          designation: scanResult.designation || 'Employee'
        }
      };
      await createIncident(payload);
      setShowChoiceModal(false);
      toast.success(`✅ Manager notified! They will visit ${scanResult.name} and fill the report.`, { duration: 5000 });
      resetScanner();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to notify manager');
    } finally {
      setDelegating(false);
    }
  };



  const isSelfScan = scanResult && user && (scanResult._id === user._id || scanResult.employeeId === user.employeeId);
  const scannedName = scanResult?.name || 'Employee';

  return (
    <div className="qr-scan-page">
      <div className="qr-scan-header">
        <button className="btn-icon" onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
        <h1>QR Identity Scanner</h1>
        <div style={{ width: 24 }}></div>
      </div>

      <div className="qr-scan-container">
        {scanning ? (
          <div className="custom-scanner-wrapper">
            {/* Mode Switcher Tabs */}
            <div className="scanner-tabs">
              <button 
                type="button"
                className={`scanner-tab ${scanMode === 'camera' ? 'active' : ''}`}
                onClick={() => setScanMode('camera')}
              >
                <Camera size={18} /> Camera Scan
              </button>
              <button 
                type="button"
                className={`scanner-tab ${scanMode === 'file' ? 'active' : ''}`}
                onClick={() => setScanMode('file')}
              >
                <Upload size={18} /> Upload Image File
              </button>
            </div>

            {scanMode === 'camera' ? (
              <div className="camera-scan-stage">
                {cameraStarting && (
                  <div className="camera-status-card">
                    <div className="spinner"></div>
                    <p>Starting Camera Viewfinder...</p>
                  </div>
                )}

                {cameraError ? (
                  <div className="camera-status-card error">
                    <AlertCircle size={48} color="#EF4444" />
                    <p>{cameraError}</p>
                    <button type="button" className="btn-switch-upload" onClick={() => setScanMode('file')}>
                      <Upload size={18} /> Switch to Image Upload
                    </button>
                  </div>
                ) : (
                  <div className={`video-viewfinder-wrapper ${cameraStarting ? 'hidden' : ''}`}>
                    <div id="qr-reader" className="clean-video-reader"></div>
                    
                    {/* Absolutely Centered HUD Overlay */}
                    <div className="laser-hud-overlay">
                      <div className="hud-box">
                        <span className="hud-corner top-left"></span>
                        <span className="hud-corner top-right"></span>
                        <span className="hud-corner bottom-left"></span>
                        <span className="hud-corner bottom-right"></span>
                        <div className="hud-laser-line"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="file-upload-stage">
                <label className="file-drop-zone">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileUpload} 
                    disabled={processing}
                    style={{ display: 'none' }}
                  />
                  <div className="drop-zone-content">
                    <div className="upload-icon-circle">
                      <Upload size={40} color="#6366f1" />
                    </div>
                    <h3>Upload QR Code Image</h3>
                    <p>Click here or browse from your device (PNG, JPG, WEBP)</p>
                    <span className="btn-browse-file">Select File</span>
                  </div>
                </label>
                <div id="file-qr-reader" style={{ display: 'none' }}></div>
              </div>
            )}

            {processing && (
              <div className="scanner-overlay">
                <div className="spinner"></div>
                <p>Validating Identity...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="scan-result-container">
            {scanResult ? (
              <div className="result-card success">
                <div className="result-icon-container">
                  <CheckCircle size={64} color="#10B981" />
                </div>
                <h2>Identity Verified</h2>
                
                <div className="employee-info-card">
                  <div className="employee-avatar">
                    {scanResult.profilePhoto ? (
                      <img src={scanResult.profilePhoto} alt="Profile" />
                    ) : (
                      <User size={40} color="var(--text-muted)" />
                    )}
                  </div>
                  
                  <div className="employee-details">
                    <h3>{scanResult.name}</h3>
                    <p className="employee-id">{scanResult.employeeId}</p>
                    
                    <div className="employee-meta">
                      <div className="meta-item">
                        <Briefcase size={16} />
                        <span>{scanResult.designation || 'No Designation'}</span>
                      </div>
                      {scanResult.department && (
                        <div className="meta-item">
                          <span>Dept: {scanResult.department.name || scanResult.department}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="profile-status-badge">
                  <div className={`status-indicator ${scanResult.profileCompleted ? 'complete' : 'incomplete'}`}></div>
                  <span>Profile {scanResult.profileCompletionPercentage}% Complete</span>
                </div>

                {isSelfScan && (
                  <div className="self-scan-notice">
                    <AlertCircle size={16} />
                    <span>This is your profile. Choose how to handle this incident below.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="result-card error">
                <div className="result-icon-container">
                  <XCircle size={64} color="#DC2626" />
                </div>
                <h2>Validation Failed</h2>
                <p className="error-message">{error}</p>
              </div>
            )}

            <button className="btn btn-primary btn-large btn-full" onClick={resetScanner}>
              <RefreshCw size={20} /> Scan Another
            </button>
          </div>
        )}
      </div>



      {/* Post-Scan Action Choice Modal */}
      {showChoiceModal && scanResult && (
        <div className="choice-modal-overlay" onClick={() => setShowChoiceModal(false)}>
          <div className="choice-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="choice-modal-header">
              <div className="choice-verified-badge">
                <CheckCircle size={20} color="#10B981" />
                <span>Identity Verified</span>
              </div>
              <button className="btn-icon choice-modal-close" onClick={() => setShowChoiceModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="choice-modal-employee">
              <div className="choice-avatar">
                {scanResult.profilePhoto
                  ? <img src={scanResult.profilePhoto} alt="Profile" />
                  : <User size={28} color="var(--text-muted)" />
                }
              </div>
              <div>
                <div className="choice-emp-name">{scanResult.name}</div>
                <div className="choice-emp-id">{scanResult.employeeId} · {scanResult.designation || 'Employee'}</div>
              </div>
            </div>

            <h2 className="choice-modal-question">How would you like to proceed?</h2>
            <p className="choice-modal-desc">Choose how the incident report for this scan should be handled.</p>

            <div className="choice-cards">
              {/* Option 1 — Self Report */}
              <button className="choice-card self" onClick={handleSelfReport}>
                <div className="choice-card-icon-wrap self">
                  <ClipboardList size={28} />
                </div>
                <div className="choice-card-body">
                  <div className="choice-card-label">
                    I'll Fill the Report Myself
                    <span className="choice-recommended-badge">Recommended</span>
                  </div>
                  <p className="choice-card-sublabel">
                    You are able to fill in the incident details and medication used right now. Your report will go to the manager for on-site confirmation.
                  </p>
                </div>
                <div className="choice-card-arrow">
                  <ArrowRight size={20} />
                </div>
              </button>

              {/* Divider */}
              <div className="choice-divider"><span>or</span></div>

              {/* Option 2 — Delegate to Manager */}
              <button className="choice-card delegate" onClick={handleDelegateToManager} disabled={delegating}>
                <div className="choice-card-icon-wrap delegate">
                  {delegating ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2, borderTopColor: '#f97316' }}></span> : <UserCheck size={28} />}
                </div>
                <div className="choice-card-body">
                  <div className="choice-card-label">
                    {delegating ? 'Notifying Manager...' : 'Let the Manager Fill It'}
                  </div>
                  <p className="choice-card-sublabel">
                    You are not in a condition to fill the form right now. Your manager will be notified immediately and will visit you to file the report on your behalf.
                  </p>
                </div>
                {!delegating && (
                  <div className="choice-card-arrow delegate">
                    <ArrowRight size={20} />
                  </div>
                )}
              </button>
            </div>

            <div className="choice-footer-note">
              <Shield size={14} />
              <span>Your safety comes first. This incident will be recorded and handled securely.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QrScan;
