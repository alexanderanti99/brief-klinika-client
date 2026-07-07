# Brief Railway Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the static brief into a Railway-ready Express app with persistent admin edits and SMTP email submissions.

**Architecture:** Express serves the static questionnaire and JSON APIs. Storage is abstracted behind a small module that uses Postgres when `DATABASE_URL` exists and a JSON file for local development. Email delivery is isolated behind a mailer module so API tests can inject a fake sender.

**Tech Stack:** Node.js 24, Express, Nodemailer, pg, node:test, Supertest.

## Global Constraints

- Keep the existing visual style and questionnaire content.
- Railway must be able to deploy from GitHub with `npm start`.
- The server must listen on `0.0.0.0:${PORT}`.
- Admin secrets must come from environment variables and must not be exposed by public APIs.
- Admin edits and response history should use `DATABASE_URL` on Railway for durable persistence.

---

### Task 1: Project Structure And Server Tests

**Files:**
- Create: `package.json`
- Create: `server.js`
- Create: `src/app.js`
- Create: `src/storage.js`
- Create: `src/mailer.js`
- Create: `test/app.test.js`
- Move: `index.html` to `public/index.html`

**Interfaces:**
- Produces: `createApp(options)` from `src/app.js`.
- Produces: `createStorage(options)` from `src/storage.js`.
- Produces: `createMailer(env)` from `src/mailer.js`.

- [ ] **Step 1: Add package metadata and test dependencies.**

Use `express`, `nodemailer`, `pg`, and `supertest`.

- [ ] **Step 2: Write failing API tests.**

Cover health, public config secrecy, admin login/config writes, and submission validation.

- [ ] **Step 3: Run tests to verify they fail.**

Run: `npm.cmd test`

- [ ] **Step 4: Implement minimal Express app and in-memory test seams.**

Build APIs in `src/app.js`, start in `server.js`, and provide JSON/Postgres storage in `src/storage.js`.

- [ ] **Step 5: Run tests to verify they pass.**

Run: `npm.cmd test`

### Task 2: Frontend API Integration

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Consumes: `GET /api/config`
- Consumes: `POST /api/submit`
- Consumes: `POST /api/admin/login`
- Consumes: `PUT /api/admin/config`
- Consumes: `GET /api/admin/responses`
- Consumes: `DELETE /api/admin/responses`

- [ ] **Step 1: Replace local-only config loading with server config loading.**

Keep hash/local fallback for downloaded HTML, but prefer `/api/config` on the server.

- [ ] **Step 2: Replace FormSubmit/webhook delivery with `/api/submit`.**

Show clear success or error messaging based on server response.

- [ ] **Step 3: Replace prompt-only admin auth with server login.**

Store no secrets in public config.

- [ ] **Step 4: Save text and hidden-field changes through `/api/admin/config`.**

Keep the existing edit-in-place behavior.

- [ ] **Step 5: Load and clear server responses through admin APIs.**

Keep local export as a fallback only.

### Task 3: Railway Deployment Files And Verification

**Files:**
- Create: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces: Railway env variable checklist.
- Produces: local run instructions.

- [ ] **Step 1: Document required Railway variables.**

Include `ADMIN_CODE`, `SESSION_SECRET`, SMTP variables, `MAIL_TO`, and `DATABASE_URL`.

- [ ] **Step 2: Run automated tests.**

Run: `npm.cmd test`

- [ ] **Step 3: Run a local server smoke test.**

Run: `npm.cmd start`, then check `GET /api/health`.

- [ ] **Step 4: Commit and push to GitHub.**

Run: `git add .`, `git commit`, and `git push origin main`.
