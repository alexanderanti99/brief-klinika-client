import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

function createFakeStorage(initialConfig = {}) {
  const state = {
    config: {
      texts: {},
      hiddenFields: [],
      ...initialConfig
    },
    responses: []
  };

  return {
    state,
    async init() {},
    async getConfig() {
      return state.config;
    },
    async saveConfig(config) {
      state.config = {
        texts: config.texts || {},
        hiddenFields: config.hiddenFields || []
      };
      return state.config;
    },
    async createResponse(record) {
      const saved = { id: state.responses.length + 1, ...record };
      state.responses.unshift(saved);
      return saved;
    },
    async listResponses() {
      return state.responses;
    },
    async clearResponses() {
      state.responses = [];
    }
  };
}

function baseEnv() {
  return {
    ADMIN_CODE: '1974',
    SESSION_SECRET: 'test-session-secret',
    MAIL_TO: 'owner@example.com',
    MAIL_FROM: 'brief@example.com',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '465',
    SMTP_USER: 'brief@example.com',
    SMTP_PASS: 'smtp-secret'
  };
}

test('health check reports ok', async () => {
  const app = createApp({
    env: baseEnv(),
    storage: createFakeStorage(),
    mailer: { sendBrief: async () => ({ accepted: ['owner@example.com'] }) }
  });

  const response = await request(app).get('/api/health').expect(200);

  assert.deepEqual(response.body, { ok: true });
});

test('public config exposes editable content without leaking secrets', async () => {
  const app = createApp({
    env: baseEnv(),
    storage: createFakeStorage({
      texts: { 'label.q::0': 'Client name' },
      hiddenFields: ['q3_colors::4']
    }),
    mailer: { sendBrief: async () => ({ accepted: ['owner@example.com'] }) }
  });

  const response = await request(app).get('/api/config').expect(200);

  assert.equal(response.body.mailConfigured, true);
  assert.deepEqual(response.body.texts, { 'label.q::0': 'Client name' });
  assert.deepEqual(response.body.hiddenFields, ['q3_colors::4']);
  assert.equal(Object.hasOwn(response.body, 'adminCode'), false);
  assert.equal(Object.hasOwn(response.body, 'SMTP_PASS'), false);
  assert.equal(Object.hasOwn(response.body, 'TELEGRAM_BOT_TOKEN'), false);
  assert.equal(Object.hasOwn(response.body, 'sessionSecret'), false);
});

test('admin config writes require authentication', async () => {
  const app = createApp({
    env: baseEnv(),
    storage: createFakeStorage(),
    mailer: { sendBrief: async () => ({ accepted: ['owner@example.com'] }) }
  });

  await request(app)
    .put('/api/admin/config')
    .send({ texts: { a: 'b' }, hiddenFields: [] })
    .expect(401);
});

test('admin can login and save questionnaire config', async () => {
  const storage = createFakeStorage();
  const app = createApp({
    env: baseEnv(),
    storage,
    mailer: { sendBrief: async () => ({ accepted: ['owner@example.com'] }) }
  });
  const agent = request.agent(app);

  await agent.post('/api/admin/login').send({ code: 'wrong' }).expect(401);
  await agent.post('/api/admin/login').send({ code: '1974' }).expect(204);

  const saveResponse = await agent
    .put('/api/admin/config')
    .send({ texts: { 'label.q::0': 'Updated' }, hiddenFields: ['q3_colors::4'] })
    .expect(200);

  assert.deepEqual(saveResponse.body.config.texts, { 'label.q::0': 'Updated' });
  assert.deepEqual(storage.state.config.hiddenFields, ['q3_colors::4']);

  const adminResponse = await agent.get('/api/admin/config').expect(200);
  assert.equal(adminResponse.body.mailTo, 'owner@example.com');
  assert.equal(adminResponse.body.mailConfigured, true);
});

test('submission validates required fields', async () => {
  const app = createApp({
    env: baseEnv(),
    storage: createFakeStorage(),
    mailer: { sendBrief: async () => ({ accepted: ['owner@example.com'] }) }
  });

  const response = await request(app)
    .post('/api/submit')
    .send({ contactName: 'A', contactPhone: '@a' })
    .expect(400);

  assert.equal(response.body.error, 'validation_failed');
  assert.ok(response.body.fields.includes('q1_name'));
});

test('valid submission is stored and sent by email', async () => {
  const storage = createFakeStorage();
  const sent = [];
  const app = createApp({
    env: baseEnv(),
    storage,
    mailer: {
      async sendBrief(record) {
        sent.push(record);
        return { accepted: ['owner@example.com'] };
      }
    }
  });

  const response = await request(app)
    .post('/api/submit')
    .send({
      contactName: 'Alexander',
      contactPhone: '@alex',
      q1_name: 'Smile Clinic',
      q2_logo: 'Да, есть',
      q4_type: 'Сайт-визитка',
      q5_services: 'Cleaning - 5000',
      q10_contacts: 'Moscow',
      features: ['Квиз']
    })
    .expect(200);

  assert.equal(response.body.ok, true);
  assert.equal(response.body.delivered, true);
  assert.equal(response.body.emailDelivered, true);
  assert.equal(response.body.telegramDelivered, false);
  assert.equal(storage.state.responses.length, 1);
  assert.equal(storage.state.responses[0].clinicName, 'Smile Clinic');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].payload.contactName, 'Alexander');
});

test('valid submission is stored without email when SMTP is not configured', async () => {
  const storage = createFakeStorage();
  const app = createApp({
    env: {
      ADMIN_CODE: '1974',
      SESSION_SECRET: 'test-session-secret'
    },
    storage,
    mailer: {
      isConfigured() {
        return false;
      },
      async sendBrief() {
        throw new Error('should not send email');
      }
    }
  });

  const response = await request(app)
    .post('/api/submit')
    .send({
      contactName: 'Alexander',
      contactPhone: '@alex',
      q1_name: 'Smile Clinic',
      q2_logo: 'Да, есть',
      q4_type: 'Сайт-визитка',
      q5_services: 'Cleaning - 5000',
      q10_contacts: 'Moscow'
    })
    .expect(200);

  assert.equal(response.body.ok, true);
  assert.equal(response.body.delivered, false);
  assert.equal(storage.state.responses.length, 1);
  assert.equal(storage.state.responses[0].clinicName, 'Smile Clinic');
});

test('valid submission is stored when email delivery fails', async () => {
  const storage = createFakeStorage();
  const app = createApp({
    env: baseEnv(),
    storage,
    logger: { error() {} },
    mailer: {
      isConfigured() {
        return true;
      },
      async sendBrief() {
        throw new Error('bad smtp credentials');
      }
    }
  });

  const response = await request(app)
    .post('/api/submit')
    .send({
      contactName: 'Alexander',
      contactPhone: '@alex',
      q1_name: 'Smile Clinic',
      q2_logo: 'Да, есть',
      q4_type: 'Сайт-визитка',
      q5_services: 'Cleaning - 5000',
      q10_contacts: 'Moscow'
    })
    .expect(200);

  assert.equal(response.body.ok, true);
  assert.equal(response.body.emailDelivered, false);
  assert.equal(response.body.delivered, false);
  assert.equal(storage.state.responses.length, 1);
});

test('valid submission sends telegram notification when configured', async () => {
  const storage = createFakeStorage();
  const telegram = [];
  const app = createApp({
    env: {
      ADMIN_CODE: '1974',
      SESSION_SECRET: 'test-session-secret'
    },
    storage,
    mailer: {
      isConfigured() {
        return false;
      },
      async sendBrief() {
        throw new Error('should not send email');
      }
    },
    notifier: {
      isConfigured() {
        return true;
      },
      async sendBrief(record) {
        telegram.push(record);
      }
    }
  });

  const response = await request(app)
    .post('/api/submit')
    .send({
      contactName: 'Alexander',
      contactPhone: '@alex',
      q1_name: 'Smile Clinic',
      q2_logo: 'Да, есть',
      q4_type: 'Сайт-визитка',
      q5_services: 'Cleaning - 5000',
      q10_contacts: 'Moscow'
    })
    .expect(200);

  assert.equal(response.body.ok, true);
  assert.equal(response.body.delivered, true);
  assert.equal(response.body.emailDelivered, false);
  assert.equal(response.body.telegramDelivered, true);
  assert.equal(storage.state.responses.length, 1);
  assert.equal(telegram.length, 1);
  assert.equal(telegram[0].payload.contactName, 'Alexander');
});
