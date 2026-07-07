import { createContext, useContext, useState, useEffect } from 'react';
import { getScanners } from '../services/api';

const ScannerContext = createContext();

export const useScanner = () => {
  const context = useContext(ScannerContext);
  if (!context) throw new Error('useScanner must be used within ScannerProvider');
  return context;
};

export const ScannerProvider = ({ children }) => {
  const [scanners, setScanners] = useState([]);
  const [selectedScanner, setSelectedScannerState] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('simplyaid_scanner');
    if (saved) {
      try {
        setSelectedScannerState(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('simplyaid_scanner');
      }
    }
  }, []);

  // Fetch scanners list
  const loadScanners = async () => {
    try {
      setLoading(true);
      const res = await getScanners();
      setScanners(res.data.data || []);
    } catch (e) {
      // silent — user may not be logged in
    } finally {
      setLoading(false);
    }
  };

  const setSelectedScanner = (scanner) => {
    setSelectedScannerState(scanner);
    if (scanner) {
      localStorage.setItem('simplyaid_scanner', JSON.stringify(scanner));
    } else {
      localStorage.removeItem('simplyaid_scanner');
    }
  };

  // Group scanners by department for the dropdown
  const scannersByDepartment = scanners.reduce((groups, scanner) => {
    const deptName = scanner.department?.name || 'Unknown';
    if (!groups[deptName]) groups[deptName] = [];
    groups[deptName].push(scanner);
    return groups;
  }, {});

  return (
    <ScannerContext.Provider value={{
      scanners,
      selectedScanner,
      setSelectedScanner,
      scannersByDepartment,
      loadScanners,
      loading
    }}>
      {children}
    </ScannerContext.Provider>
  );
};
