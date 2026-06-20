import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { changePassword } from '../services/api';
import { Globe, Lock, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Settings = () => {
  const { t, user, isGuest, lang, switchLang, requireAuth } = useAuth();
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  const handlePwChange = async (e) => {
    e.preventDefault();
    requireAuth(async () => {
      if (pwForm.newPassword !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
      try { await changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }); toast.success('Password changed'); setPwForm({ currentPassword: '', newPassword: '', confirm: '' }); }
      catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    });
  };

  return (
    <div className="page-content">
      <div className="page-header"><div><h1 className="page-title">{t('nav.settings')}</h1><p className="page-subtitle">Application configuration</p></div></div>

      <div className="grid-2">
        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}><Globe size={20} color="var(--accent)" /><h3 className="card-title" style={{margin:0}}>Language / भाषा</h3></div>
          <div style={{display:'flex',gap:12}}>
            <button className={`btn ${lang==='en'?'btn-primary':'btn-ghost'}`} onClick={() => switchLang('en')} style={{flex:1}}>English</button>
            <button className={`btn ${lang==='hi'?'btn-primary':'btn-ghost'}`} onClick={() => switchLang('hi')} style={{flex:1}}>हिन्दी</button>
          </div>
        </div>

        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}><Building2 size={20} color="var(--info)" /><h3 className="card-title" style={{margin:0}}>Company Info</h3></div>
          <div style={{fontSize:'0.9rem',color:'var(--text-secondary)'}}>
            {isGuest ? (
              <p style={{color:'var(--text-muted)',fontStyle:'italic'}}>Sign in to view your company and profile details.</p>
            ) : (
              <>
                <p><strong>Company:</strong> {user?.company?.name || '-'}</p>
                <p><strong>Role:</strong> {user?.role?.replace('_',' ')}</p>
                <p><strong>Department:</strong> {user?.department?.name || '-'}</p>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}><Lock size={20} color="var(--warning)" /><h3 className="card-title" style={{margin:0}}>Change Password</h3></div>
          <form onSubmit={handlePwChange}>
            <div className="form-group"><label className="form-label">Current Password</label><input type="password" required value={pwForm.currentPassword} onChange={e => setPwForm(f => ({...f, currentPassword: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">New Password</label><input type="password" required minLength={6} value={pwForm.newPassword} onChange={e => setPwForm(f => ({...f, newPassword: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Confirm New Password</label><input type="password" required value={pwForm.confirm} onChange={e => setPwForm(f => ({...f, confirm: e.target.value}))} /></div>
            <button type="submit" className="btn btn-warning">Update Password</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
