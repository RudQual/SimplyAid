import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { validateQrScan } from '../services/api';
import toast from 'react-hot-toast';
import { ScanLine, CheckCircle, XCircle, User, Briefcase, RefreshCw, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './QrScan.css';

const QrScan = () => {
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();
  const scannerRef = useRef(null);

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
          </div>
        )}
      </div>
    </div>
  );
};

export default QrScan;
