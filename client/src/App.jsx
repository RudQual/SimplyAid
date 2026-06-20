import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/common/Sidebar';
import Navbar from './components/common/Navbar';
import AuthRequiredModal from './components/common/AuthRequiredModal';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Incidents from './pages/Incidents';
import NewIncident from './pages/NewIncident';
import IncidentDetail from './pages/IncidentDetail';
import Inventory from './pages/Inventory';
import Employees from './pages/Employees';
import Departments from './pages/Departments';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Prescriptions from './pages/Prescriptions';
import VendingMachine from './pages/VendingMachine';
import EmployeeProfile from './pages/EmployeeProfile';
import EmployeeIdCard from './pages/EmployeeIdCard';
import ScanHistory from './pages/ScanHistory';

// Allows guests to view pages. Only blocks if a logged-in user lacks the required role.
const GuestableRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;
  // Guests can see everything — pages handle their own action-gating
  if (!user) return children;
  // REMOVED: role check so all logged-in users can view pages
  // if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
};

// Strictly protected — guests are redirected to login (for write-only pages)
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" />;
  // REMOVED: role check so all logged-in users can view pages
  // if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
};

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <Navbar />
      <main className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <Routes>
          <Route path="/" element={<GuestableRoute><Dashboard /></GuestableRoute>} />
          <Route path="/incidents" element={<GuestableRoute><Incidents /></GuestableRoute>} />
          <Route path="/incidents/new" element={<ProtectedRoute><NewIncident /></ProtectedRoute>} />
          <Route path="/incidents/:id" element={<ProtectedRoute><IncidentDetail /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute roles={['admin']}><Inventory /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute roles={['admin']}><Employees /></ProtectedRoute>} />
          <Route path="/employees/:id" element={<ProtectedRoute><EmployeeProfile /></ProtectedRoute>} />
          <Route path="/employees/:id/card" element={<ProtectedRoute><EmployeeIdCard /></ProtectedRoute>} />
          <Route path="/departments" element={<ProtectedRoute roles={['admin']}><Departments /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute roles={['admin']}><Reports /></ProtectedRoute>} />
          <Route path="/scan-history" element={<ProtectedRoute roles={['admin']}><ScanHistory /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
          <Route path="/prescriptions" element={<ProtectedRoute><Prescriptions /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <AuthRequiredModal />
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#1e2538', color: '#f1f5f9', border: '1px solid #2d3a52', borderRadius: '10px' } }} />
        <Routes>
          <Route path="/vending" element={<VendingMachine />} />
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
