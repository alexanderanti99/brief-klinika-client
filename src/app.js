import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import { isMailEnvConfigured } from './mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const oneDayMs = 24 * 60 * 60 * 1000;

const requiredSubmissionFields = [
  'contactName',
  'contactPhone',
  'q1_name',
  'q2_logo',
  'q4_type',
  'q5_services',
  'q10_contacts'
];

function envValue(env, key, fallback = '') {
  return env[key] || fallback;
}

function getAdminCode(env) {
  return envValue(env, 'ADMIN_CODE', '1974');
}

function getSessionSecret(env) {
  return envValue(env, 'SESSION_SECRET', 'dev-session-secret-change-me');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signSession(expiry, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(String(expiry))
    .digest('base64url');
}

function createSessionCookie(env) {
  const expiry = Date.now() + oneDayMs;
  const signature = signSession(expiry, getSessionSecret(env));
  return `${expiry}.${signature}`;
}

function isValidSessionCookie(value, env) {
  if (!value || typeof value !== 'string') return false;
  const [expiryRaw, signature] = value.split('.');
  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry) || expiry < Date.now() || !signature) return false;
  const expected = signSession(expiry, getSessionSecret(env));
  return safeEqual(signature, expected);
}

function normalizeConfig(input) {
  const texts = input && typeof input.texts === 'object' && !Array.isArray(input.texts)
    ? Object.fromEntries(
      Object.entries(input.texts)
        .filter(([key, value]) => typeof key === 'string' && typeof value === 'string')
        .map(([key, value]) => [key.slice(0, 160), value.slice(0, 20000)])
    )
    : {};
  const hiddenFields = Array.isArray(input?.hiddenFields)
    ? input.hiddenFields
      .filter((value) => typeof value === 'string')
      .map((value) => value.slice(0, 160))
    : [];

  return { texts, hiddenFields };
}

function publicConfig(config, mailConfigured) {
  const normalized = normalizeConfig(config);
  return {
    ...normalized,
    mailConfigured
  };
}

function hiddenFieldNames(config) {
  return new Set(
    (config.hiddenFields || [])
      .map((key) => String(key).split('::')[0])
      .filter(Boolean)
  );
}

function validateSubmission(payload, config) {
  const hidden = hiddenFieldNames(config);
  return requiredSubmissionFields.filter((field) => {
    if (hidden.has(field)) return false;
    const value = payload[field];
    return typeof value !== 'string' || value.trim().length === 0;
  });
}

function normalizeSubmission(body) {
  const payload = {};
  Object.entries(body || {}).forEach(([key, value]) => {
    if (key === 'features' || key === 'feat') return;
    if (typeof value === 'string') {
      payload[key] = value.trim();
    }
  });

  const rawFeatures = Array.isArray(body?.features)
    ? body.features
    : Array.isArray(body?.feat)
      ? body.feat
      : typeof body?.feat === 'string'
        ? [body.feat]
        : [];
  payload.features = rawFeatures
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  return payload;
}

function makeRecord(payload) {
  return {
    clinicName: payload.q1_name || 'Без названия',
    submittedAt: new Date().toISOString(),
    payload
  };
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function createApp(options = {}) {
  const env = options.env || process.env;
  const storage = options.storage;
  const mailer = options.mailer;
  if (!storage) throw new Error('storage is required');
  if (!mailer) throw new Error('mailer is required');

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const mailConfigured = () => {
    if (typeof mailer.isConfigured === 'function') return mailer.isConfigured();
    return isMailEnvConfigured(env);
  };

  const requireAdmin = (req, res, next) => {
    if (isValidSessionCookie(req.cookies.brief_admin_session, env)) {
      next();
      return;
    }
    res.status(401).json({ error: 'unauthorized' });
  };

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/config', asyncRoute(async (req, res) => {
    const config = await storage.getConfig();
    res.json(publicConfig(config, mailConfigured()));
  }));

  app.post('/api/submit', asyncRoute(async (req, res) => {
    const config = await storage.getConfig();
    const payload = normalizeSubmission(req.body);
    const missingFields = validateSubmission(payload, config);
    if (missingFields.length > 0) {
      res.status(400).json({ error: 'validation_failed', fields: missingFields });
      return;
    }

    const record = makeRecord(payload);
    const saved = await storage.createResponse(record);
    if (!mailConfigured()) {
      res.status(503).json({
        error: 'mail_not_configured',
        responseId: saved.id || null
      });
      return;
    }

    try {
      await mailer.sendBrief(saved);
      res.json({ ok: true, delivered: true, responseId: saved.id || null });
    } catch (error) {
      console.error('mail delivery failed', error);
      res.status(502).json({
        error: 'mail_delivery_failed',
        responseId: saved.id || null
      });
    }
  }));

  app.post('/api/admin/login', (req, res) => {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!safeEqual(code, getAdminCode(env))) {
      res.status(401).json({ error: 'invalid_code' });
      return;
    }
    res.cookie('brief_admin_session', createSessionCookie(env), {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production' || Boolean(env.RAILWAY_PUBLIC_DOMAIN),
      maxAge: oneDayMs
    });
    res.status(204).end();
  });

  app.post('/api/admin/logout', (req, res) => {
    res.clearCookie('brief_admin_session');
    res.status(204).end();
  });

  app.get('/api/admin/config', requireAdmin, asyncRoute(async (req, res) => {
    const config = await storage.getConfig();
    res.json({
      config: normalizeConfig(config),
      mailTo: envValue(env, 'MAIL_TO', ''),
      mailConfigured: mailConfigured()
    });
  }));

  app.put('/api/admin/config', requireAdmin, asyncRoute(async (req, res) => {
    const config = await storage.saveConfig(normalizeConfig(req.body));
    res.json({
      config: normalizeConfig(config),
      mailConfigured: mailConfigured()
    });
  }));

  app.get('/api/admin/responses', requireAdmin, asyncRoute(async (req, res) => {
    const responses = await storage.listResponses();
    res.json({ responses });
  }));

  app.delete('/api/admin/responses', requireAdmin, asyncRoute(async (req, res) => {
    await storage.clearResponses();
    res.status(204).end();
  }));

  app.use(express.static(publicDir));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
