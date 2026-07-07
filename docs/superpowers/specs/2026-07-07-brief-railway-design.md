# Brief Railway Server Design

## Goal

Deploy the brief questionnaire as a Railway-ready server application that lets an administrator edit questionnaire text and receives completed forms by email.

## Current State

- The project is a single static `index.html`.
- Admin edits are stored in browser `localStorage`, so another browser or a deployed server does not see them.
- Form delivery currently depends on client-side FormSubmit or webhook behavior.
- Railway needs a server process that listens on `process.env.PORT`.

## Approved Approach

Use a small Node.js Express app:

- Serve the existing questionnaire from `public/index.html`.
- Expose public config through `GET /api/config`.
- Accept submissions through `POST /api/submit`.
- Protect admin writes with a short admin login and an HttpOnly cookie.
- Store admin text, hidden fields, and submitted responses in Postgres when `DATABASE_URL` is present.
- Fall back to a local JSON store for local development without Railway Postgres.
- Send email through SMTP with Nodemailer.

## Required Railway Variables

- `ADMIN_CODE`: admin login code.
- `SESSION_SECRET`: random long value for signing admin sessions.
- `MAIL_TO`: destination email for completed briefs.
- `MAIL_FROM`: sender email; defaults to `SMTP_USER` when omitted.
- `SMTP_HOST`: SMTP server host.
- `SMTP_PORT`: SMTP server port, usually `465` or `587`.
- `SMTP_USER`: SMTP username.
- `SMTP_PASS`: SMTP password or app password.
- `DATABASE_URL`: Railway Postgres connection string. Recommended for durable admin edits and response history.

## Data Model

Settings:

- `texts`: object keyed by editable element id.
- `hiddenFields`: array of field keys hidden by admin.
- `deliveryEmail`: display-only admin value derived from `MAIL_TO`.

Responses:

- `id`
- `submittedAt`
- `clinicName`
- `payload`

## API

- `GET /api/health`: returns `{ ok: true }`.
- `GET /api/config`: returns public questionnaire config.
- `POST /api/submit`: validates the form, stores it, sends email, returns delivery status.
- `POST /api/admin/login`: checks `ADMIN_CODE`, sets an HttpOnly cookie.
- `POST /api/admin/logout`: clears the cookie.
- `GET /api/admin/config`: returns admin config and mail status.
- `PUT /api/admin/config`: saves text and hidden-field changes.
- `GET /api/admin/responses`: returns saved responses.
- `DELETE /api/admin/responses`: clears saved responses.

## Error Handling

- Public submission rejects missing required fields with `400`.
- Mail misconfiguration returns `503` for submission attempts.
- Failed SMTP delivery returns `502` and keeps a stored response for recovery.
- Admin endpoints return `401` when the admin session is missing or invalid.

## Testing

Use Node's built-in test runner and Supertest:

- health check works.
- public config does not leak secrets.
- admin config writes require authentication.
- login accepts the configured admin code.
- submission validates required data.
- valid submission stores data and calls the mailer.
