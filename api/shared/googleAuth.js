const admin = require('firebase-admin');
const { json } = require('./http');

const ADMIN_EMAILS = getAdminEmails();

async function requireAuthenticatedUser(context, req) {
  const idToken = extractBearerToken(req);

  if (!idToken) {
    json(context, 401, { message: 'Missing Google ID token.' });
    return null;
  }

  try {
    const firebaseApp = getFirebaseAdminApp();
    const payload = await firebaseApp.auth().verifyIdToken(idToken);

    if (!(payload?.uid || payload?.sub) || !payload.email) {
      json(context, 401, { message: 'Invalid Firebase ID token payload.' });
      return null;
    }

    return {
      id: payload.uid || payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      avatar: payload.picture || '',
    };
  } catch (error) {
    context.log.warn('Firebase ID token verification failed', {
      errorMessage: error?.message || 'Unknown Google token verification error.',
    });

    json(context, 401, {
      message: error?.message || 'Invalid or expired Firebase ID token.',
    });
    return null;
  }
}

function getFirebaseAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || '');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

function getAdminEmails() {
  const rawValue =
    process.env.ADMIN_EMAILS ||
    process.env.VITE_ADMIN_EMAILS ||
    'kim1801x5@gmail.com';

  return rawValue
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminUser(user) {
  if (!user?.email) {
    return false;
  }

  return ADMIN_EMAILS.includes(user.email.toLowerCase());
}

function normalizePrivateKey(value) {
  return value.replace(/\\n/g, '\n').trim();
}

function extractBearerToken(req) {
  const directGoogleToken =
    req.headers?.['x-google-id-token'] ||
    req.headers?.['X-Google-Id-Token'];

  if (typeof directGoogleToken === 'string' && directGoogleToken.trim()) {
    return directGoogleToken.trim();
  }

  const authorization = req.headers?.authorization || req.headers?.Authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
}

module.exports = {
  isAdminUser,
  requireAuthenticatedUser,
};
