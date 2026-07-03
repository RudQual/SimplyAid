import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { validateQrScan, getBoxes, getInventoryItems, createIncident } from '../services/api';
import toast from 'react-hot-toast';
import { ScanLine, CheckCircle, XCircle, User, Briefcase, RefreshCw, ChevronLeft, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './QrScan.css';

const QrScan = () => {
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

  useEffect(() => {
    // Initialize Scanner when component mounts and scanning is true
    if (scanning && !scannerRef.current) {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] 
        },
        /* verbose= */ false
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

  useEffect(() => {
    if (scanResult) {
      fetchFormData();
    }
  }, [scanResult]);

  const fetchFormData = async () => {
    try {
      const [boxesRes, itemsRes] = await Promise.all([
        getBoxes(),
        getInventoryItems()
      ]);
      setBoxes(boxesRes.data.data || []);
      setItems(itemsRes.data.data || []);
      if (boxesRes.data.data?.length > 0) setReportData(prev => ({ ...prev, boxId: boxesRes.data.data[0]._id }));
      if (itemsRes.data.data?.length > 0) setReportData(prev => ({ ...prev, itemId: itemsRes.data.data[0]._id }));
    } catch (e) {
      toast.error('Failed to load inventory data');
    }
  };

  const onScanSuccess = async (decodedText, decodedResult) => {
    // Prevent multiple calls if already processing
    if (processing) return;

    try {
      setProcessing(true);
      // Pause scanner UI immediately
      if (scannerRef.current) {
        scannerRef.current.pause();
      }

      // Try to parse the QR JSON payload
      const payload = JSON.parse(decodedText);
      
      const res = await validateQrScan(payload);
      
      setScanResult(res.data.data);
      setError(null);
      setScanning(false);
      toast.success(res.data.message || 'QR Validated');
      
      // We can clear the scanner entirely since we found a result
      if (scannerRef.current) {
        await scannerRef.current.clear();
        scannerRef.current = null;
      }
      
    } catch (err) {
      // JSON parse error or backend validation error
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

  const onScanFailure = (error) => {
    // Usually ignoring normal scan failures (e.g. no QR in frame yet)
  };

  const resetScanner = () => {
    setScanResult(null);
    setError(null);
    setScanning(true);
    setShowModal(false);
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportData.boxId || !reportData.itemId) return toast.error('Please select a box and an item');
    if (reportData.quantity < 1) return toast.error('Quantity must be at least 1');
    
    try {
      setSubmitting(true);
      const selectedItem = items.find(i => i._id === reportData.itemId);
      const deptId = scanResult.department?._id || scanResult.department;
      
      const payload = {
        department: deptId,
        incidentType: 'illness',
        severity: 'minor',
        description: `Self-reported medication usage: ${reportData.reason || 'No specific symptoms recorded'}`,
        location: 'First Aid Station',
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
      toast.success('Medication report submitted for Manager confirmation');
      setShowModal(false);
      resetScanner();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="qr-scan-page">
      <div className="qr-scan-header">
        <button className="btn-icon" onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
        <h1>QR Identity Scanner</h1>
        <div style={{ width: 24 }}></div> {/* Spacer for centering */}
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
              <button className="btn btn-secondary btn-large btn-full" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>
                <Plus size={20} /> Report Medication Used
              </button>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Report Medication Usage</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleReportSubmit} className="modal-form">
              <div className="form-group">
                <label>First Aid Box Used</label>
                <select 
                  className="form-control" 
                  value={reportData.boxId} 
                  onChange={e => setReportData({...reportData, boxId: e.target.value})}
                  required
                >
                  {boxes.map(box => (
                    <option key={box._id} value={box._id}>{box.boxId} ({box.location})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Medication / Item Taken</label>
                <select 
                  className="form-control" 
                  value={reportData.itemId} 
                  onChange={e => setReportData({...reportData, itemId: e.target.value})}
                  required
                >
                  {items.map(item => (
                    <option key={item._id} value={item._id}>{item.name} ({item.category})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Quantity</label>
                <input 
                  type="number" 
                  className="form-control" 
                  min="1" 
                  value={reportData.quantity} 
                  onChange={e => setReportData({...reportData, quantity: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Symptoms or Reason (Optional)</label>
                <textarea 
                  className="form-control" 
                  rows="3" 
                  value={reportData.reason} 
                  onChange={e => setReportData({...reportData, reason: e.target.value})}
                  placeholder="e.g. Headache, minor cut..."
                ></textarea>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QrScan;
