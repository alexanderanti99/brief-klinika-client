import { createApp } from './src/app.js';
import { createMailer } from './src/mailer.js';
import { createStorage } from './src/storage.js';
import { createTelegramNotifier } from './src/telegram.js';

const env = process.env;
const storage = createStorage({ env });
await storage.init();

const app = createApp({
  env,
  storage,
  mailer: createMailer(env),
  notifier: createTelegramNotifier(env)
});

const port = Number(env.PORT || 3000);
app.listen(port, '0.0.0.0', () => {
  console.log(`Brief server listening on ${port}`);
});
