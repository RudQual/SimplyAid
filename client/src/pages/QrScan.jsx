import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { validateQrScan, getMedicationOptions, createIncident } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { ScanLine, CheckCircle, XCircle, User, Briefcase, RefreshCw, ChevronLeft, Plus, X, Pill, MapPin, Package, Hash, FileText, AlertCircle, Camera, Upload, Trash2, ClipboardList, UserCheck, ArrowRight, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './QrScan.css';

const QrScan = () => {
  const { user } = useAuth();
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

  // Medication Report State
  const [showModal, setShowModal] = useState(false);
  const [boxes, setBoxes] = useState([]);
  const [items, setItems] = useState([]);
  const [reportData, setReportData] = useState({ boxId: '', reason: '' });
  const [selectedItems, setSelectedItems] = useState([{ itemId: '', quantity: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

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

  // When scan result arrives, show the action choice modal for self-scans
  useEffect(() => {
    if (scanResult && user) {
      const isSelfScan = scanResult._id === user._id || scanResult.employeeId === user.employeeId;
      if (isSelfScan) {
        setShowChoiceModal(true);
      }
    }
  }, [scanResult]);

  const openMedicationModal = async () => {
    setLoadingOptions(true);
    setShowModal(true);
    try {
      const res = await getMedicationOptions();
      const { boxes: boxList, items: itemList } = res.data.data;
      setBoxes(boxList || []);
      setItems(itemList || []);
      if (boxList?.length > 0) setReportData(prev => ({ ...prev, boxId: boxList[0]._id }));
      if (itemList?.length > 0) setSelectedItems([{ itemId: itemList[0]._id, quantity: 1 }]);
    } catch (e) {
      toast.error('Failed to load medication options');
      console.error(e);
    } finally {
      setLoadingOptions(false);
    }
  };

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

  const handleAddItemRow = () => {
    setSelectedItems([...selectedItems, { itemId: items[0]?._id || '', quantity: 1 }]);
  };

  const handleRemoveItemRow = (index) => {
    if (selectedItems.length <= 1) return;
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...selectedItems];
    updated[index][field] = value;
    setSelectedItems(updated);
  };

  const resetScanner = () => {
    setScanResult(null);
    setError(null);
    setScanning(true);
    setShowModal(false);
    setShowChoiceModal(false);
    setReportData({ boxId: '', reason: '' });
    setSelectedItems([{ itemId: '', quantity: 1 }]);
  };

  const handleSelfReport = async () => {
    setShowChoiceModal(false);
    await openMedicationModal();
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
        location: 'Pending manager on-site assessment',
        outcome: 'under_observation',
        department: deptId,
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

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportData.boxId) return toast.error('Please select a First Aid Box');
    
    const validItems = selectedItems.filter(i => i.itemId && Number(i.quantity) > 0);
    if (validItems.length === 0) return toast.error('Please select at least one medication with quantity >= 1');
    
    try {
      setSubmitting(true);
      const selectedBox = boxes.find(b => b._id === reportData.boxId);
      const deptId = scanResult.department?._id || scanResult.department || user?.department?._id || user?.department || undefined;
      
      const itemsUsedPayload = validItems.map(i => {
        const found = items.find(item => item._id === i.itemId);
        return {
          item: i.itemId,
          itemName: found?.name || 'Unknown Item',
          quantity: Number(i.quantity)
        };
      });

      const itemsSummary = itemsUsedPayload.map(i => `${i.itemName} (x${i.quantity})`).join(', ');

      const payload = {
        department: deptId,
        incidentType: 'illness',
        severity: 'minor',
        description: `Self-reported medication usage: ${itemsSummary} from box ${selectedBox?.boxId || 'Unknown'}. ${reportData.reason ? 'Symptoms: ' + reportData.reason : 'No specific symptoms recorded.'}`,
        location: selectedBox?.location || 'First Aid Station',
        outcome: 'returned_to_work',
        firstAidBoxUsed: reportData.boxId,
        itemsUsed: itemsUsedPayload,
        injuredPerson: {
          name: scanResult.name,
          employeeId: scanResult.employeeId,
          department: deptId,
          designation: scanResult.designation || 'Employee'
        }
      };

      await createIncident(payload);
      toast.success('Medication report submitted! Pending manager confirmation.');
      setShowModal(false);
      resetScanner();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
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

            {scanResult && !isSelfScan && (
              <button className="btn btn-medication btn-large btn-full" onClick={openMedicationModal} style={{ marginTop: 12 }}>
                <Pill size={20} /> Report Medication Used
              </button>
            )}
          </div>
        )}
      </div>

      {/* Medication Report Modal */}
      {showModal && (
        <div className="med-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="med-modal" onClick={e => e.stopPropagation()}>
            <div className="med-modal-header">
              <div className="med-modal-title-group">
                <div className="med-modal-icon">
                  <Pill size={22} />
                </div>
                <div>
                  <h2>Report Medication Usage</h2>
                  <p className="med-modal-subtitle">Select the medication you took. A manager will confirm this report.</p>
                </div>
              </div>
              <button className="btn-icon med-modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            {loadingOptions ? (
              <div className="med-modal-loading">
                <div className="spinner"></div>
                <p>Loading medication options...</p>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="med-modal-form">
                {/* Employee Info Summary */}
                <div className="med-employee-summary">
                  <User size={16} />
                  <span><strong>{scanResult?.name}</strong> ({scanResult?.employeeId})</span>
                </div>

                <div className="med-form-grid">
                  {/* First Aid Box */}
                  <div className="med-form-group">
                    <label>
                      <Package size={14} />
                      First Aid Box Used
                    </label>
                    <select 
                      className="med-select" 
                      value={reportData.boxId} 
                      onChange={e => setReportData({...reportData, boxId: e.target.value})}
                      required
                    >
                      <option value="" disabled>Select a box...</option>
                      {boxes.map(box => (
                        <option key={box._id} value={box._id}>
                          {box.boxId} — {box.location}{box.floor ? ` (${box.floor})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Medications / Items Taken List */}
                  <div className="med-form-group" style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ margin: 0 }}>
                        <Pill size={14} />
                        Medications / Items Taken
                      </label>
                      <button 
                        type="button" 
                        onClick={handleAddItemRow}
                        style={{
                          background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)',
                          padding: '4px 10px', borderRadius: 16, fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'
                        }}
                      >
                        <Plus size={13} /> Add Item
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {selectedItems.map((row, index) => (
                        <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-app)', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                          <div style={{ flex: 1 }}>
                            <select 
                              className="med-select" 
                              value={row.itemId} 
                              onChange={e => handleItemChange(index, 'itemId', e.target.value)}
                              required
                              style={{ margin: 0, width: '100%' }}
                            >
                              <option value="" disabled>Select an item...</option>
                              {items.map(item => (
                                <option key={item._id} value={item._id}>
                                  {item.name} ({item.category})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div style={{ width: 85 }}>
                            <input 
                              type="number" 
                              className="med-input" 
                              min="1" 
                              max="50"
                              value={row.quantity} 
                              onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                              required
                              placeholder="Qty"
                              style={{ margin: 0, width: '100%', textAlign: 'center' }}
                            />
                          </div>
                          {selectedItems.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => handleRemoveItemRow(index)}
                              style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              title="Remove item"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="med-form-group">
                  <label>
                    <FileText size={14} />
                    Symptoms or Reason <span className="optional-label">(Optional)</span>
                  </label>
                  <textarea 
                    className="med-textarea" 
                    rows="3" 
                    value={reportData.reason} 
                    onChange={e => setReportData({...reportData, reason: e.target.value})}
                    placeholder="e.g. Headache, minor cut, stomach ache..."
                  ></textarea>
                </div>

                {/* Info Banner */}
                <div className="med-info-banner">
                  <AlertCircle size={15} />
                  <span>This report will be sent to your <strong>Manager</strong> for on-site confirmation, then to the <strong>Doctor</strong> for review.</span>
                </div>

                <div className="med-modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? (
                      <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span> Submitting...</>
                    ) : (
                      <><Pill size={16} /> Submit Report</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
