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
- `MAIL_TO` - where completed briefs are sent.
- `MAIL_FROM` - sender address. Optional if it matches `SMTP_USER`.
- `SMTP_HOST` - SMTP server.
- `SMTP_PORT` - `465` or `587`.
- `SMTP_USER` - SMTP login.
- `SMTP_PASS` - SMTP password or app password.
- `SMTP_SECURE` - `true` for port `465`, usually `false` for `587`.
- `DATABASE_URL` - recommended Railway Postgres reference variable.

Without `DATABASE_URL`, the app uses a local JSON file. That is fine for local development, but Railway production should use Postgres so admin edits and responses survive redeploys.
