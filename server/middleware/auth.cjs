const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET environment variable is not set. Server cannot start securely.');
  process.exit(1);
}
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase not configured — auth will use legacy fallback');
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice(7);

  // Try custom JWT first (from OTP auth flow)
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.id && decoded.email) {
      const db = require('../db.cjs');
      const user = db.prepare('SELECT id, name, email, role, avatar FROM users WHERE id = ? AND email = ?').get(decoded.id, decoded.email);
      if (user) {
        if (process.env.DEBUG_AUTH === '1') console.log('[Auth] Verified:', user.id);
        req.user = { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar };
        return next();
      }
    }
  } catch (_) { /* not a custom JWT, try other methods */ }

  // Try Supabase auth
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        console.error('[Auth] Supabase token verification failed:', error?.message || 'No user');
        return res.status(401).json({ error: 'Invalid token' });
      }

      const sbUser = data.user;
      const uid = sbUser.id;
      const email = sbUser.email || '';
      const name = sbUser.user_metadata?.display_name || sbUser.user_metadata?.full_name || email.split('@')[0] || 'User';
      const avatar = sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.photo_url || null;

      const db = require('../db.cjs');
      let user = db.prepare('SELECT id, name, email, role, avatar FROM users WHERE firebase_uid = ?').get(uid);

      if (!user) {
        const existingByEmail = email ? db.prepare('SELECT id FROM users WHERE email = ?').get(email) : null;

        if (existingByEmail) {
          if (process.env.DEBUG_AUTH === '1') console.log('[Auth] Linking provider uid to existing user:', existingByEmail.id);
          db.prepare('UPDATE users SET firebase_uid = ?, avatar = COALESCE(avatar, ?) WHERE id = ?').run(uid, avatar, existingByEmail.id);
          user = db.prepare('SELECT id, name, email, role, avatar FROM users WHERE id = ?').get(existingByEmail.id);
        } else {
          const id = 'usr_' + uid.slice(0, 8);
          if (process.env.DEBUG_AUTH === '1') console.log('[Auth] Creating new user:', id);
          db.prepare('INSERT OR IGNORE INTO users (id, name, email, role, avatar, firebase_uid) VALUES (?, ?, ?, ?, ?, ?)').run(id, name, email, 'user', avatar, uid);
          db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(id);
          user = db.prepare('SELECT id, name, email, role, avatar FROM users WHERE firebase_uid = ?').get(uid);
          if (!user) user = { id, name, email, role: 'user', avatar };
        }
      }

      if (process.env.DEBUG_AUTH === '1') console.log('[Auth] Verified:', user.id);
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        providerUid: uid
      };
      return next();
    } catch (err) {
      console.error('[Auth] Supabase error:', err.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // Fallback: try Firebase Admin (legacy)
  try {
    const admin = require('firebase-admin');
    if (admin.getApps().length > 0) {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const db = require('../db.cjs');
      let user = db.prepare('SELECT id, name, email, role, avatar FROM users WHERE firebase_uid = ?').get(decodedToken.uid);
      if (!user) {
        const id = 'usr_' + decodedToken.uid.slice(0, 8);
        const name = decodedToken.name || decodedToken.email?.split('@')[0] || 'User';
        const email = decodedToken.email || '';
        const avatar = decodedToken.picture || null;
        const existingByEmail = email ? db.prepare('SELECT id FROM users WHERE email = ?').get(email) : null;
        if (existingByEmail) {
          db.prepare('UPDATE users SET firebase_uid = ?, avatar = COALESCE(avatar, ?) WHERE id = ?').run(decodedToken.uid, avatar, existingByEmail.id);
          user = db.prepare('SELECT id, name, email, role, avatar FROM users WHERE id = ?').get(existingByEmail.id);
        } else {
          db.prepare('INSERT OR IGNORE INTO users (id, name, email, role, avatar, firebase_uid) VALUES (?, ?, ?, ?, ?, ?)').run(id, name, email, 'user', avatar, decodedToken.uid);
          db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(id);
          user = db.prepare('SELECT id, name, email, role, avatar FROM users WHERE firebase_uid = ?').get(decodedToken.uid);
          if (!user) user = { id, name, email, role: 'user', avatar };
        }
      }
      req.user = { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar, providerUid: decodedToken.uid };
      return next();
    }
  } catch (err) {
    console.error('[Auth] Firebase fallback error:', err.message);
  }

  return res.status(401).json({ error: 'Invalid token' });
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

function artistOrAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'artist') {
    return res.status(403).json({ error: 'Artist or admin access required' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly, artistOrAdmin, JWT_SECRET };
