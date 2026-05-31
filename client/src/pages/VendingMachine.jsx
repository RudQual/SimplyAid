import { useState } from 'react';
import { Pill, KeyRound, CheckCircle, PackageOpen, ChevronLeft } from 'lucide-react';
import { vendingLogin, vendingDispense } from '../services/api';
import toast from 'react-hot-toast';
import './VendingMachine.css';

const VendingMachine = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [user, setUser] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dispensingId, setDispensingId] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!employeeId) return;

    setLoading(true);
    try {
      const { data } = await vendingLogin({ employeeId });
      setUser(data.data.user);
      setPrescriptions(data.data.prescriptions);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to find employee record');
    } finally {
      setLoading(false);
    }
  };

  const handleDispense = async (prescription) => {
    if (prescription.prescribedQty - prescription.consumedQty <= 0) return;
    
    setDispensingId(prescription._id);
    
    try {
      // Simulate physical lock delay
      await new Promise(r => setTimeout(r, 1500));
      
      const { data } = await vendingDispense({
        employeeId: user.employeeId,
        prescriptionId: prescription._id,
        qty: 1
      });
      
      // Update local state
      setPrescriptions(prev => prev.map(p => {
        if (p._id === prescription._id) {
          return { ...p, consumedQty: p.consumedQty + 1 };
        }
        return p;
      }));
      
      toast.success(`${prescription.item?.name} dispensed successfully!`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to dispense item');
    } finally {
      setDispensingId(null);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setPrescriptions([]);
    setEmployeeId('');
  };

  if (!user) {
    return (
      <div className="vending-layout vending-login-bg">
        <div className="vending-card">
          <div className="vending-header">
            <KeyRound size={40} className="vending-icon" />
            <h1>Medical Dispenser</h1>
            <p>Scan your ID or enter your Employee ID</p>
          </div>
          <form onSubmit={handleLogin} className="vending-form">
            <input
              type="text"
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value.toUpperCase())}
              placeholder="Enter Employee ID"
              className="vending-input"
              autoFocus
            />
            <button type="submit" className="vending-btn" disabled={loading || !employeeId}>
              {loading ? 'Verifying...' : 'Access Dispenser'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="vending-layout vending-dashboard-bg">
      <nav className="vending-nav">
        <div className="vending-nav-left">
          <div className="vending-logo">SimplyAID Dispenser</div>
        </div>
        <div className="vending-nav-right">
          <div className="vending-user-info">
            <span className="vending-user-name">{user.name}</span>
            <span className="vending-user-id">{user.employeeId}</span>
          </div>
          <button onClick={handleLogout} className="vending-logout-btn">
            <ChevronLeft size={16} /> Exit
          </button>
        </div>
      </nav>

      <main className="vending-main">
        <div className="vending-welcome">
          <h2>Select Medication to Dispense</h2>
          <p>You can only dispense items prescribed to you.</p>
        </div>

        {prescriptions.length === 0 ? (
          <div className="vending-empty">
            <CheckCircle size={48} className="vending-success-icon" />
            <h3>No Active Prescriptions</h3>
            <p>You have taken all your prescribed medication or have none active.</p>
          </div>
        ) : (
          <div className="vending-grid">
            {prescriptions.map(p => {
              const remaining = p.prescribedQty - p.consumedQty;
              const isDispensing = dispensingId === p._id;
              
              return (
                <div key={p._id} className={`vending-item-card ${remaining === 0 ? 'empty' : ''}`}>
                  <div className="vending-item-icon">
                    <Pill size={32} />
                  </div>
                  <div className="vending-item-details">
                    <h3>{p.item?.name}</h3>
                    <p className="vending-item-cat">{p.item?.category}</p>
                    <div className="vending-item-stats">
                      <span className="vending-stat-label">Remaining:</span>
                      <span className="vending-stat-value">{remaining} {p.item?.unit}</span>
                    </div>
                  </div>
                  <div className="vending-item-action">
                    <button 
                      onClick={() => handleDispense(p)} 
                      className={`vending-dispense-btn ${isDispensing ? 'dispensing' : ''}`}
                      disabled={remaining === 0 || dispensingId !== null}
                    >
                      {isDispensing ? (
                        <><PackageOpen size={18} className="spin-icon" /> Unlocking...</>
                      ) : remaining > 0 ? (
                        'Dispense'
                      ) : (
                        'Limit Reached'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default VendingMachine;
