import { renderBriefText } from './brief-format.js';

const telegramMessageLimit = 3900;

export function isTelegramEnvConfigured(env = process.env) {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

function splitMessage(text) {
  const chunks = [];
  for (let index = 0; index < text.length; index += telegramMessageLimit) {
    chunks.push(text.slice(index, index + telegramMessageLimit));
  }
  return chunks.length ? chunks : [''];
}

export function createTelegramNotifier(env = process.env, fetchImpl = globalThis.fetch) {
  const configured = isTelegramEnvConfigured(env);

  return {
    isConfigured() {
      return configured;
    },
    async sendBrief(record) {
      if (!configured) {
        throw new Error('Telegram is not configured');
      }
      if (typeof fetchImpl !== 'function') {
        throw new Error('Fetch API is not available');
      }

      const text = `Анкета сохранена в админке.\n\n${renderBriefText(record)}`;
      const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      for (const chunk of splitMessage(text)) {
        const response = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: chunk,
            disable_web_page_preview: true
          })
        });
        if (!response.ok) {
          throw new Error(`Telegram API failed with status ${response.status}`);
        }
        const body = await response.json().catch(() => ({ ok: true }));
        if (body.ok === false) {
          throw new Error('Telegram API rejected the message');
        }
      }
    }
  };
}
