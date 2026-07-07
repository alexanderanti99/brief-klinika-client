# Brief Site

Railway-ready questionnaire server for a clinic website brief.

## Local Run

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Railway Setup

Connect this GitHub repository to a Railway service. Railway should run:

```bash
npm start
```

Set these variables on the app service:

- `ADMIN_CODE` - code for `#admin`.
- `SESSION_SECRET` - long random string for admin cookies.
- `DATABASE_URL` - recommended Railway Postgres reference variable.

Without `DATABASE_URL`, the app uses a local JSON file. That is fine for local development, but Railway production should use Postgres so admin edits and responses survive redeploys.

Email delivery is optional. The form always saves responses in the admin panel when storage is configured. If you also want email notifications, add these SMTP variables:

- `MAIL_TO` - where completed briefs are sent.
- `MAIL_FROM` - sender address. Optional; defaults to `SMTP_USER`.
- `SMTP_HOST` - SMTP server.
- `SMTP_PORT` - `465` or `587`.
- `SMTP_USER` - SMTP login for the server's sender mailbox.
- `SMTP_PASS` - SMTP password or app password for that sender mailbox.
- `SMTP_SECURE` - `true` for port `465`, usually `false` for `587`.

The client filling out the brief never enters email credentials. SMTP variables belong to the server-side sender mailbox only.

Telegram delivery is optional too. If you want Telegram notifications with the full brief text, add:

- `TELEGRAM_BOT_TOKEN` - token from `@BotFather`.
- `TELEGRAM_CHAT_ID` - your personal chat id or group chat id.
