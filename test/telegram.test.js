import assert from 'node:assert/strict';
import test from 'node:test';
import { createTelegramNotifier, isTelegramEnvConfigured } from '../src/telegram.js';

test('telegram config requires bot token and chat id', () => {
  assert.equal(isTelegramEnvConfigured({}), false);
  assert.equal(isTelegramEnvConfigured({ TELEGRAM_BOT_TOKEN: 'token' }), false);
  assert.equal(isTelegramEnvConfigured({ TELEGRAM_CHAT_ID: '123' }), false);
  assert.equal(isTelegramEnvConfigured({
    TELEGRAM_BOT_TOKEN: 'token',
    TELEGRAM_CHAT_ID: '123'
  }), true);
});

test('telegram notifier posts brief text to bot api', async () => {
  const calls = [];
  const notifier = createTelegramNotifier({
    TELEGRAM_BOT_TOKEN: '123:secret',
    TELEGRAM_CHAT_ID: '456'
  }, async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return { ok: true };
      }
    };
  });

  await notifier.sendBrief({
    clinicName: 'Smile Clinic',
    submittedAt: '2026-07-07T10:00:00.000Z',
    payload: {
      contactName: 'Alexander',
      contactPhone: '@alex',
      q1_name: 'Smile Clinic',
      q10_contacts: 'Moscow'
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.telegram.org/bot123:secret/sendMessage');
  assert.equal(calls[0].options.method, 'POST');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.chat_id, '456');
  assert.match(body.text, /Анкета сохранена в админке/);
  assert.match(body.text, /Alexander/);
  assert.match(body.text, /Smile Clinic/);
});
