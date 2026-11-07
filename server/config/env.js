/**
 * Validates environment configuration at startup so the server fails fast
 * instead of running with an insecure or broken configuration.
 */
const validateEnv = () => {
  const errors = [];
  const isProd = process.env.NODE_ENV === 'production';

  if (!process.env.MONGO_URI) errors.push('MONGO_URI is required');

  const secret = process.env.JWT_SECRET || '';
  if (!secret) {
    errors.push('JWT_SECRET is required');
  } else if (secret === 'your_jwt_secret_key_here' || secret.length < 32) {
    if (isProd) errors.push('JWT_SECRET must be a random string of at least 32 characters in production');
    else console.warn('⚠️  JWT_SECRET is weak. Use a random string of 32+ characters (e.g. `openssl rand -hex 32`).');
  }

  if (isProd && process.env.ENABLE_DEMO_LOGIN === 'true') {
    errors.push('ENABLE_DEMO_LOGIN must not be enabled in production');
  }

  if (errors.length) {
    console.error('❌ Invalid configuration:\n  - ' + errors.join('\n  - '));
    process.exit(1);
  }
};

const demoLoginEnabled = () => process.env.ENABLE_DEMO_LOGIN === 'true' && process.env.NODE_ENV !== 'production';
const selfSignupEnabled = () => process.env.ALLOW_SELF_SIGNUP !== 'false';

module.exports = { validateEnv, demoLoginEnabled, selfSignupEnabled };
