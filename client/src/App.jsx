import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ScannerProvider } from './contexts/ScannerContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ConfirmProvider, PageLoader } from './components/ui';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import GlobalSearch from './components/layout/GlobalSearch';
import ErrorBoundary from './components/layout/ErrorBoundary';
import './components/layout/layout.css';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NotificationCenter = lazy(() => import('./pages/NotificationCenter'));
const Incidents = lazy(() => import('./pages/Incidents'));
const NewIncident = lazy(() => import('./pages/NewIncident'));
const IncidentDetail = lazy(() => import('./pages/IncidentDetail'));
const ReviewQueue = lazy(() => import('./pages/ReviewQueue'));
const Treatments = lazy(() => import('./pages/Treatments'));
const NewTreatment = lazy(() => import('./pages/NewTreatment'));
const TreatmentDetail = lazy(() => import('./pages/TreatmentDetail'));
const QrScan = lazy(() => import('./pages/QrScan'));
const Kits = lazy(() => import('./pages/Kits'));
const KitDetail = lazy(() => import('./pages/KitDetail'));
const KitInspection = lazy(() => import('./pages/KitInspection'));
const KitByCode = lazy(() => import('./pages/KitByCode'));
const Inventory = lazy(() => import('./pages/Inventory'));
const InventoryItemDetail = lazy(() => import('./pages/InventoryItemDetail'));
const Expiry = lazy(() => import('./pages/Expiry'));
const StockMovements = lazy(() => import('./pages/StockMovements'));
const Compliance = lazy(() => import('./pages/Compliance'));
const Inspections = lazy(() => import('./pages/Inspections'));
const InspectionDetail = lazy(() => import('./pages/InspectionDetail'));
const Reports = lazy(() => import('./pages/Reports'));
const SafetyAnalytics = lazy(() => import('./pages/SafetyAnalytics'));
const Employees = lazy(() => import('./pages/Employees'));
const EmployeeProfile = lazy(() => import('./pages/EmployeeProfile'));
const EmployeeIdCard = lazy(() => import('./pages/EmployeeIdCard'));
const Departments = lazy(() => import('./pages/Departments'));
const ScanHistory = lazy(() => import('./pages/ScanHistory'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

const STAFF = ['admin', 'doctor', 'manager'];
const MEDICAL = ['admin', 'doctor'];

/** Requires sign-in; optionally restricts to roles (admins pass every role check). */
const Protected = ({ roles, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && user.role !== 'admin' && !roles.includes(user.role)) return <NotFound forbidden />;
  return children;
};

const LegacyInspectRedirect = () => <Navigate to={`/kits/${useParams().id}/inspect`} replace />;
const LegacyScanRedirect = () => <Navigate to={`/kits/code/${useParams().boxId}`} replace />;

const AppLayout = () => {
  // Subscribing to the auth context re-renders every page when the language is switched.
  useAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('simplyaid_sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  const toggle = useCallback(() => setCollapsed((c) => {
    localStorage.setItem('simplyaid_sidebar', c ? 'expanded' : 'collapsed');
    return !c;
  }), []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} onToggle={toggle} mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      <Topbar collapsed={collapsed} onMenu={() => setMobileOpen(true)} onSearch={() => setSearchOpen(true)} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <main className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/notifications" element={<NotificationCenter />} />

              <Route path="/incidents" element={<Incidents />} />
              <Route path="/incidents/new" element={<NewIncident />} />
              <Route path="/incidents/:id" element={<IncidentDetail />} />
              <Route path="/reviews" element={<Protected roles={['doctor', 'manager']}><ReviewQueue /></Protected>} />
              <Route path="/treatments" element={<Protected roles={MEDICAL}><Treatments /></Protected>} />
              <Route path="/treatments/new" element={<Protected roles={MEDICAL}><NewTreatment /></Protected>} />
              <Route path="/treatments/:id" element={<Protected roles={MEDICAL}><TreatmentDetail /></Protected>} />
              <Route path="/qr-scan" element={<QrScan />} />

              <Route path="/kits" element={<Protected roles={STAFF}><Kits /></Protected>} />
              <Route path="/kits/code/:boxId" element={<KitByCode />} />
              <Route path="/kits/:id" element={<Protected roles={STAFF}><KitDetail /></Protected>} />
              <Route path="/kits/:id/inspect" element={<Protected roles={STAFF}><KitInspection /></Protected>} />
              <Route path="/inventory" element={<Protected roles={STAFF}><Inventory /></Protected>} />
              <Route path="/inventory/:id" element={<Protected roles={STAFF}><InventoryItemDetail /></Protected>} />
              <Route path="/expiry" element={<Protected roles={STAFF}><Expiry /></Protected>} />
              <Route path="/stock-movements" element={<Protected roles={STAFF}><StockMovements /></Protected>} />

              <Route path="/compliance" element={<Protected roles={STAFF}><Compliance /></Protected>} />
              <Route path="/inspections" element={<Protected roles={STAFF}><Inspections /></Protected>} />
              <Route path="/inspections/:id" element={<Protected roles={STAFF}><InspectionDetail /></Protected>} />
              <Route path="/reports" element={<Protected roles={STAFF}><Reports /></Protected>} />
              <Route path="/analytics" element={<Protected roles={STAFF}><SafetyAnalytics /></Protected>} />

              <Route path="/employees" element={<Protected roles={STAFF}><Employees /></Protected>} />
              <Route path="/employees/:id" element={<Protected roles={STAFF}><EmployeeProfile /></Protected>} />
              <Route path="/employees/:id/card" element={<Protected roles={STAFF}><EmployeeIdCard /></Protected>} />
              <Route path="/departments" element={<Protected roles={MEDICAL}><Departments /></Protected>} />
              <Route path="/scan-history" element={<Protected roles={STAFF}><ScanHistory /></Protected>} />
              <Route path="/activity" element={<Protected roles={MEDICAL}><ActivityLog /></Protected>} />

              <Route path="/profile" element={<MyProfile />} />
              <Route path="/settings" element={<Settings />} />

              {/* Old URLs */}
              <Route path="/manager-dashboard" element={<Navigate to="/reviews" replace />} />
              <Route path="/doctor-dashboard" element={<Navigate to="/reviews" replace />} />
              <Route path="/inventory/boxes/scan/:boxId" element={<LegacyScanRedirect />} />
              <Route path="/inventory/boxes/:id/inspect" element={<LegacyInspectRedirect />} />
              <Route path="/compliance-dashboard" element={<Navigate to="/compliance" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <ConfirmProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: { background: '#1d1f1b', color: '#fbf8f0', borderRadius: '4px', fontSize: '0.9rem', padding: '10px 14px' },
            success: { iconTheme: { primary: '#5aa86f', secondary: '#1d1f1b' } },
            error: { iconTheme: { primary: '#e2564d', secondary: '#1d1f1b' }, duration: 5000 }
          }}
        />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={(
              <Protected>
                <ScannerProvider>
                  <NotificationProvider>
                    <AppLayout />
                  </NotificationProvider>
                </ScannerProvider>
              </Protected>
            )} />
          </Routes>
        </Suspense>
      </ConfirmProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
