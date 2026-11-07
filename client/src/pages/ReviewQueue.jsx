import { useAuth } from '../contexts/AuthContext';
import DoctorDashboard from './DoctorDashboard';
import ManagerDashboard from './ManagerDashboard';

/** Incident review workflow: managers confirm/fill reports on-site, doctors review referrals. */
const ReviewQueue = () => {
  const { user } = useAuth();
  return user.role === 'manager' ? <ManagerDashboard /> : <DoctorDashboard />;
};

export default ReviewQueue;
