import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { validateQrScan, getMedicationOptions, createIncident } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { ScanLine, CheckCircle, XCircle, User, Briefcase, RefreshCw, ChevronLeft, Plus, X, Pill, MapPin, Package, Hash, FileText, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './QrScan.css';

const QrScan = () => {
  const { user } = useAuth();
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();
  const scannerRef = useRef(null);

  // Medication Report State
  const [showModal, setShowModal] = useState(false);
  const [boxes, setBoxes] = useState([]);
  const [items, setItems] = useState([]);
  const [reportData, setReportData] = useState({ boxId: '', itemId: '', quantity: 1, reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (scanning && !scannerRef.current) {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] 
        },
        false
      );
      scanner.render(onScanSuccess, onScanFailure);
      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [scanning]);

  // When scan result arrives, check if it's a self-scan and auto-show medication popup
  useEffect(() => {
    if (scanResult && user) {
      const isSelfScan = scanResult._id === user._id || scanResult.employeeId === user.employeeId;
      if (isSelfScan) {
        // Self-scan: auto-open the medication popup
        openMedicationModal();
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
      if (itemList?.length > 0) setReportData(prev => ({ ...prev, itemId: itemList[0]._id }));
    } catch (e) {
      toast.error('Failed to load medication options');
      console.error(e);
    } finally {
      setLoadingOptions(false);
    }
  };

  const onScanSuccess = async (decodedText) => {
    if (processing) return;

    try {
      setProcessing(true);
      if (scannerRef.current) {
        scannerRef.current.pause();
      }

      const payload = JSON.parse(decodedText);
      const res = await validateQrScan(payload);
      
      setScanResult(res.data.data);
      setError(null);
      setScanning(false);
      toast.success(res.data.message || 'QR Validated');
      
      if (scannerRef.current) {
        await scannerRef.current.clear();
        scannerRef.current = null;
      }
      
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid QR Code format');
      setScanResult(null);
      setScanning(false);
      toast.error('Invalid QR Code');
      
      if (scannerRef.current) {
        await scannerRef.current.clear();
        scannerRef.current = null;
      }
    } finally {
      setProcessing(false);
    }
  };

  const onScanFailure = () => {};

  const resetScanner = () => {
    setScanResult(null);
    setError(null);
    setScanning(true);
    setShowModal(false);
    setReportData({ boxId: '', itemId: '', quantity: 1, reason: '' });
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportData.boxId || !reportData.itemId) return toast.error('Please select a box and an item');
    if (reportData.quantity < 1) return toast.error('Quantity must be at least 1');
    
    try {
      setSubmitting(true);
      const selectedItem = items.find(i => i._id === reportData.itemId);
      const selectedBox = boxes.find(b => b._id === reportData.boxId);
      const deptId = scanResult.department?._id || scanResult.department;
      
      const payload = {
        department: deptId,
        incidentType: 'illness',
        severity: 'minor',
        description: `Self-reported medication: ${selectedItem?.name || 'Unknown'} (x${reportData.quantity}) from box ${selectedBox?.boxId || 'Unknown'}. ${reportData.reason ? 'Symptoms: ' + reportData.reason : 'No specific symptoms recorded.'}`,
        location: selectedBox?.location || 'First Aid Station',
        outcome: 'returned_to_work',
        firstAidBoxUsed: reportData.boxId,
        itemsUsed: [{
          item: reportData.itemId,
          itemName: selectedItem?.name || 'Unknown Item',
          quantity: Number(reportData.quantity)
        }],
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

  return (
    <div className="qr-scan-page">
      <div className="qr-scan-header">
        <button className="btn-icon" onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
        <h1>QR Identity Scanner</h1>
        <div style={{ width: 24 }}></div>
      </div>

      <div className="qr-scan-container">
        {scanning ? (
          <div className="scanner-wrapper">
            <div id="qr-reader" className="qr-reader"></div>
            {processing && (
              <div className="scanner-overlay">
                <div className="spinner"></div>
                <p>Validating...</p>
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
                    <span>This is your profile. Report any medication you took below.</span>
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

            {scanResult && (
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

                  {/* Medication Item */}
                  <div className="med-form-group">
                    <label>
                      <Pill size={14} />
                      Medication / Item Taken
                    </label>
                    <select 
                      className="med-select" 
                      value={reportData.itemId} 
                      onChange={e => setReportData({...reportData, itemId: e.target.value})}
                      required
                    >
                      <option value="" disabled>Select an item...</option>
                      {items.map(item => (
                        <option key={item._id} value={item._id}>
                          {item.name} ({item.category})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quantity */}
                <div className="med-form-group">
                  <label>
                    <Hash size={14} />
                    Quantity Taken
                  </label>
                  <input 
                    type="number" 
                    className="med-input" 
                    min="1" 
                    max="20"
                    value={reportData.quantity} 
                    onChange={e => setReportData({...reportData, quantity: e.target.value})}
                    required
                  />
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
    </div>
  );
};

export default QrScan;
