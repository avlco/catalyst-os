import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'verify'
  const [otpCode, setOtpCode] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      navigate('/');
    } catch (err) {
      if (err.status === 403) {
        setError(t('auth.emailNotVerified'));
        setMode('verify');
      } else {
        setError(err.message || t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await base44.auth.register({ email, password });
      setMode('verify');
      setError('');
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await base44.auth.verifyOtp({ email, otpCode });
      // Now login
      await base44.auth.loginViaEmailPassword(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || t('auth.verificationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    base44.auth.loginWithProvider('google', window.location.origin + '/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-display mb-2">
            Business<span className="text-primary">OS</span>
          </h1>
          <p className="text-muted-foreground text-body-l">
            {mode === 'register' ? t('auth.createYourAccount') : mode === 'verify' ? t('auth.verifyYourEmail') : t('auth.loginSubtitle')}
          </p>
        </div>

        {mode === 'verify' ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-body-m text-muted-foreground text-center">
              {t('auth.verificationSentTo')} <strong>{email}</strong>
            </p>
            <div>
              <label htmlFor="otp" className="text-body-m font-medium block mb-1.5">
                {t('auth.verificationCode')}
              </label>
              <Input
                id="otp"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder={t('auth.verificationCodePlaceholder')}
                required
                autoComplete="one-time-code"
              />
            </div>
            {error && <p className="text-danger text-body-m">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('common.loading') : t('auth.verifyAndSignIn')}
            </Button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await base44.auth.resendOtp(email);
                  setError('');
                } catch (err) {
                  setError(err.message);
                }
              }}
              className="w-full text-center text-body-m text-primary hover:underline"
            >
              {t('auth.resendCode')}
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={mode === 'register' ? handleRegister : handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-body-m font-medium block mb-1.5">
                  {t('auth.email')}
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="password" className="text-body-m font-medium block mb-1.5">
                  {t('auth.password')}
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
              </div>

              {error && <p className="text-danger text-body-m">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('common.loading') : mode === 'register' ? t('auth.createAccount') : t('auth.login')}
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-body-m text-primary hover:underline"
              >
                {mode === 'login' ? t('auth.noAccountSignUp') : t('auth.hasAccountSignIn')}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-caption">
                <span className="bg-background px-2 text-muted-foreground">{t('auth.or')}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleGoogleLogin}
            >
              {t('auth.googleLogin')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
