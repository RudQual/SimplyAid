import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, LogIn, UserPlus } from 'lucide-react';
import './AuthRequiredModal.css';

const AuthRequiredModal = () => {
  const { showAuthModal, setShowAuthModal, t } = useAuth();
  const navigate = useNavigate();

  if (!showAuthModal) return null;

  const handleSignIn = () => {
    setShowAuthModal(false);
    navigate('/login');
  };

  const handleSignUp = () => {
    setShowAuthModal(false);
    navigate('/login?mode=signup');
  };

  const handleDismiss = () => {
    setShowAuthModal(false);
  };

  return (
    <div className="auth-modal-overlay" onClick={handleDismiss}>
      <div className="auth-modal-card" onClick={e => e.stopPropagation()}>
        <div className="auth-modal-icon">
          <Lock size={30} />
        </div>
        <h2 className="auth-modal-title">{t('guest.authRequired')}</h2>
        <p className="auth-modal-message">{t('guest.authMessage')}</p>
        <div className="auth-modal-actions">
          <button className="auth-modal-btn-primary" onClick={handleSignIn} id="auth-modal-signin-btn">
            <LogIn size={18} /> {t('guest.signInBtn')}
          </button>
          <button className="auth-modal-btn-secondary" onClick={handleSignUp} id="auth-modal-signup-btn">
            <UserPlus size={18} /> {t('guest.signUpBtn')}
          </button>
        </div>
        <button className="auth-modal-dismiss" onClick={handleDismiss}>
          {t('guest.continueExploring')}
        </button>
      </div>
    </div>
  );
};

export default AuthRequiredModal;
