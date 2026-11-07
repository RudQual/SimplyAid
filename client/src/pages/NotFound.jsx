import { Link } from 'react-router-dom';
import { Compass, Lock } from 'lucide-react';

const NotFound = ({ forbidden = false }) => (
  <div className="page-content">
    <div className="card" style={{ maxWidth: 560, margin: '8vh auto 0' }}>
      <div className="empty-state">
        <div className={`empty-state-icon ${forbidden ? 'tone-amber' : 'tone-blue'}`}>{forbidden ? <Lock size={24} /> : <Compass size={24} />}</div>
        <h3>{forbidden ? 'You don’t have access to this page' : 'Page not found'}</h3>
        <p>{forbidden ? 'Your role doesn’t include this area. Contact an administrator if you need access.' : 'The page you’re looking for doesn’t exist or has moved.'}</p>
        <Link to="/" className="btn btn-primary">Back to dashboard</Link>
      </div>
    </div>
  </div>
);

export default NotFound;
