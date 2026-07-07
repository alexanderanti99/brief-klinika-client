import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import { defaultFormSchema } from './default-schema.js';
import { isMailEnvConfigured } from './mailer.js';
import { isTelegramEnvConfigured } from './telegram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const oneDayMs = 24 * 60 * 60 * 1000;

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeId(value, fallback) {
  return String(value || fallback).trim().replace(/[^a-zA-Z0-9_:-]/g, '_').slice(0, 80);
}

function normalizeField(field, index) {
  const type = ['text', 'textarea', 'radio', 'checkbox'].includes(field?.type) ? field.type : 'text';
  const id = normalizeId(field?.id, `field_${index + 1}`);
  const options = Array.isArray(field?.options)
    ? field.options.filter((option) => typeof option === 'string' && option.trim()).map((option) => option.trim().slice(0, 500))
    : [];
  return {
    id,
    type,
    label: String(field?.label || id).slice(0, 500),
    hint: String(field?.hint || '').slice(0, 1000),
    placeholder: String(field?.placeholder || '').slice(0, 500),
    required: Boolean(field?.required),
    options,
    showWhen: field?.showWhen && typeof field.showWhen === 'object'
      ? {
        fieldId: normalizeId(field.showWhen.fieldId, ''),
        value: String(field.showWhen.value || '').slice(0, 500)
      }
      : null
  };
}

function normalizeFormSchema(schema) {
  const source = schema && schema.version === defaultFormSchema.version && Array.isArray(schema.sections)
    ? schema
    : defaultFormSchema;
  const sections = source.sections
    .map((section, sectionIndex) => ({
      id: normalizeId(section?.id, `section_${sectionIndex + 1}`),
      eyebrow: String(section?.eyebrow || `Раздел ${sectionIndex + 1}`).slice(0, 160),
      title: String(section?.title || `Раздел ${sectionIndex + 1}`).slice(0, 300),
      fields: Array.isArray(section?.fields)
        ? section.fields.map(normalizeField).filter((field) => field.id && field.label)
        : []
    }))
    .filter((section) => section.fields.length > 0);

  return {
    version: defaultFormSchema.version,
    sections: sections.length > 0 ? sections : clone(defaultFormSchema.sections)
  };
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

  return {
    texts,
    hiddenFields,
    formSchema: normalizeFormSchema(input?.formSchema)
  };
}

function publicConfig(config, mailConfigured, telegramConfigured) {
  const normalized = normalizeConfig(config);
  return {
    ...normalized,
    mailConfigured,
    telegramConfigured
  };
}

function hiddenFieldNames(config) {
  return new Set(
    (config.hiddenFields || [])
      .map((key) => String(key).split('::')[0])
      .filter(Boolean)
  );
}

function isFieldActive(field, payload) {
  if (!field.showWhen?.fieldId || !field.showWhen?.value) return true;
  const value = payload[field.showWhen.fieldId];
  return Array.isArray(value)
    ? value.includes(field.showWhen.value)
    : value === field.showWhen.value;
}

function validateSubmission(payload, config) {
  const hidden = hiddenFieldNames(config);
  const schema = normalizeFormSchema(config.formSchema);
  return schema.sections.flatMap((section) => section.fields).filter((field) => {
    if (!field.required || hidden.has(field.id) || !isFieldActive(field, payload)) return false;
    const value = payload[field.id];
    if (Array.isArray(value)) return value.length === 0;
    return typeof value !== 'string' || value.trim().length === 0;
  }).map((field) => field.id);
}

function buildFieldLabels(schema) {
  const labels = {};
  normalizeFormSchema(schema).sections.forEach((section) => {
    section.fields.forEach((field) => {
      labels[field.id] = field.label;
    });
  });
  return labels;
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

function makeRecord(payload, config) {
  return {
    clinicName: payload.q1_name || 'Без названия',
    submittedAt: new Date().toISOString(),
    payload: {
      ...payload,
      _fieldLabels: buildFieldLabels(config.formSchema)
    }
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
  const logger = options.logger || console;
  const notifier = options.notifier || {
    isConfigured: () => false,
    sendBrief: async () => {}
  };
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
  const telegramConfigured = () => {
    if (typeof notifier.isConfigured === 'function') return notifier.isConfigured();
    return isTelegramEnvConfigured(env);
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
    res.json(publicConfig(config, mailConfigured(), telegramConfigured()));
  }));

  app.post('/api/submit', asyncRoute(async (req, res) => {
    const config = await storage.getConfig();
    const payload = normalizeSubmission(req.body);
    const missingFields = validateSubmission(payload, config);
    if (missingFields.length > 0) {
      res.status(400).json({ error: 'validation_failed', fields: missingFields });
      return;
    }

    const record = makeRecord(payload, config);
    const saved = await storage.createResponse(record);
    let emailDelivered = false;
    let telegramDelivered = false;

    if (mailConfigured()) {
      try {
        await mailer.sendBrief(saved);
        emailDelivered = true;
      } catch (error) {
        logger.error('mail delivery failed', error.message);
      }
    }

    if (telegramConfigured()) {
      try {
        await notifier.sendBrief(saved);
        telegramDelivered = true;
      } catch (error) {
        logger.error('telegram delivery failed', error.message);
      }
    }

    res.json({
      ok: true,
      delivered: emailDelivered || telegramDelivered,
      emailDelivered,
      telegramDelivered,
      responseId: saved.id || null
    });
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
      mailConfigured: mailConfigured(),
      telegramConfigured: telegramConfigured()
    });
  }));

  app.put('/api/admin/config', requireAdmin, asyncRoute(async (req, res) => {
    const config = await storage.saveConfig(normalizeConfig(req.body));
    res.json({
      config: normalizeConfig(config),
      mailConfigured: mailConfigured(),
      telegramConfigured: telegramConfigured()
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
    logger.error(error);
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
