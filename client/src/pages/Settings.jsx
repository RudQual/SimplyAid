import { useState } from 'react';
import toast from 'react-hot-toast';
import { Globe, Lock, Building2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { changePassword } from '../services/api';
import { PageHeader, Card, Field, Spinner, Segmented } from '../components/ui';
import { errorMessage, labelize, formatDateTime } from '../utils/format';

const Settings = () => {
  const { user, lang, switchLang, updateSession, t } = useAuth();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => { setPw((p) => ({ ...p, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined, form: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!pw.currentPassword) er.currentPassword = 'Enter your current password';
    if (pw.newPassword.length < 8 || !/[A-Za-z]/.test(pw.newPassword) || !/\d/.test(pw.newPassword)) er.newPassword = 'At least 8 characters with a letter and a number';
    else if (pw.newPassword === pw.currentPassword) er.newPassword = 'Choose a different password';
    if (pw.confirm !== pw.newPassword) er.confirm = 'Passwords do not match';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const res = await changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      updateSession(res.data.token, res.data.data);
      toast.success('Password updated. Other devices have been signed out.');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setErrors({ form: errorMessage(err, 'Could not update the password') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: 1000 }}>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="grid-2">
        <div className="stack">
          <Card title={t('settings.account')} icon={Building2}>
            <div className="detail-list" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="detail-row"><span className="detail-label">{t('settings.name')}</span><span className="detail-value">{user.name}</span></div>
              <div className="detail-row"><span className="detail-label">{t('settings.email')}</span><span className="detail-value">{user.email}</span></div>
              <div className="detail-row"><span className="detail-label">{t('settings.role')}</span><span className="detail-value"><span className={`badge badge-${user.role}`}>{labelize(user.role)}</span></span></div>
              <div className="detail-row"><span className="detail-label">{t('settings.department')}</span><span className="detail-value">{user.department?.name || '—'}</span></div>
              <div className="detail-row"><span className="detail-label">{t('settings.company')}</span><span className="detail-value">{user.company?.name || '—'}</span></div>
              <div className="detail-row"><span className="detail-label">{t('settings.lastSignIn')}</span><span className="detail-value">{formatDateTime(user.lastLoginAt)}</span></div>
            </div>
          </Card>
          <Card title={t('settings.language')} icon={Globe} subtitle={t('settings.languageSub')}>
            <Segmented value={lang} onChange={switchLang} options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'हिन्दी' }]} />
          </Card>
        </div>
        <Card title={t('settings.changePw')} icon={Lock} subtitle={t('settings.changePwSub')}>
          {errors.form && <div className="alert alert-danger mb-16">{errors.form}</div>}
          <form onSubmit={submit} noValidate>
            <Field label={t('settings.currentPw')} error={errors.currentPassword}><input type={show ? 'text' : 'password'} value={pw.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" /></Field>
            <Field label={t('settings.newPw')} error={errors.newPassword} hint={t('settings.pwHint')}><input type={show ? 'text' : 'password'} value={pw.newPassword} onChange={set('newPassword')} autoComplete="new-password" /></Field>
            <Field label={t('settings.confirmPw')} error={errors.confirm}><input type={show ? 'text' : 'password'} value={pw.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
            <div className="row-between">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShow((s) => !s)}>{show ? <EyeOff size={15} /> : <Eye size={15} />} {show ? t('settings.hide') : t('settings.show')}</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size="sm" light /> : <><ShieldCheck size={16} /> {t('settings.update')}</>}</button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
