# Efficient Global Backend

Standalone Express API for the Efficient Global app. It handles the public website's
two submission forms (schedule a delivery, request information), persists them to
MongoDB, emails a notification through Resend, and serves the session-authenticated
admin dashboard endpoints.

## Stack

- Node.js with ES modules (`"type": "module"`)
- Express 4
- MongoDB driver 7 (no ODM — plain collections and repositories)
- Resend for transactional email
- bcryptjs for admin password hashing

## Getting Started

```bash
npm install
cp .env.example .env   # then fill in the real values
npm run dev
```

The server defaults to `http://127.0.0.1:5050`. On startup it connects to MongoDB and
creates the indexes for the `admins`, `admin_sessions`, `delivery_requests`, and
`information_requests` collections. If MongoDB is unreachable the process logs the
error and exits with code 1.

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the server (`node src/server.js`) |
| `npm start` | Same as `dev` — used by Render in production |
| `npm run seed:admin` | Create the first super admin account (see below) |

There is no watch mode or build step; restart the process after code changes.

## Project Structure

```
src/
  server.js                  Express app, CORS, health checks, route mounting, startup
  config/database.js         MongoClient singleton (connect / get / close)
  constants/admin.js         Admin role and status enums
  routes/                    HTTP layer: validation, status codes, cookies
    admin.js                 /api/admin/*  (login, session, profile, dashboard reads)
    deliveryRequest.js       /api/delivery-request
    requestInformation.js    /api/request-information
  services/                  Business logic, sanitization, email composition
    adminService.js          Passwords, sessions, profile rules, account creation
    deliveryRequestService.js / requestInformationService.js
    deliveryRequestEmail.js / requestInformationEmail.js
    resendEmail.js           Shared Resend client, recipient parsing, HTML escaping
  repositories/              MongoDB access and index definitions
scripts/seedAdmin.js         One-off super admin seeder
```

The layering is consistent: routes never touch MongoDB directly, services never read
`req`/`res`, and repositories are the only place collection names appear.

## API

### Health

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Service name and `status: "ok"` |
| `GET` | `/health` | Liveness check, always `200` while the process is up |
| `GET` | `/health/db` | Pings MongoDB; `503` with `connected: false` on failure |

```bash
curl http://127.0.0.1:5050/health
curl http://127.0.0.1:5050/health/db
```

### Public form submissions

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/delivery-request` | Schedule-a-delivery form |
| `POST` | `/api/request-information` | Request-information form |

Both endpoints validate the body, save the submission with `status: "new"` and
`emailNotification.status: "pending"`, then send the Resend email and flip that status
to `sent` or `failed`.

- `400` — validation failed; body is `{ message, errors }` where `errors` is keyed by
  field name so the frontend can render inline messages.
- `500` — the database write failed and nothing was saved.
- `502` — the submission was saved but the notification email could not be sent.
- `201` — success; returns `{ deliveryRequestId | requestInformationId, message }`.

Delivery request fields: `pickup`, `delivery`, `datetime`, `vehicle`, `name`, `email`,
`phone`, `rush` are required; `instructions` and `source` are optional (`source`
defaults to `schedule-delivery`). `datetime` must parse as a date and must not be in
the past.

Request information fields: `name`, `email`, `phone`, `message` are required;
`organization` and `source` are optional (`source` defaults to `request-information`).

Email must match a basic address pattern; phone must contain 10–15 digits and only
digits, spaces, and `+ ( ) . -`.

### Admin

All admin routes authenticate with the session token, accepted either as the
`efficient_global_admin_session` cookie or an `Authorization: Bearer <token>` header.
Every route below returns `401 Not authenticated.` when the session is missing or
expired.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/admin/login` | Sign in; sets the session cookie and returns the token |
| `POST` | `/api/admin/logout` | Delete the session and clear the cookie |
| `GET` | `/api/admin/me` | Current admin for the session |
| `GET` | `/api/admin/delivery-requests` | Delivery requests, newest first |
| `GET` | `/api/admin/information-requests` | Information requests, newest first |
| `PATCH` | `/api/admin/profile` | Update display name |
| `PATCH` | `/api/admin/password` | Change password |
| `PATCH` | `/api/admin/profile-image` | Set profile image (base64 data URL) |
| `DELETE` | `/api/admin/profile-image` | Remove profile image |

Login accepts `identifier` (also `email` or `username`), `password`, and optional
`keepMeLoggedIn`. The identifier can be a full email address or just the local part
before the `@`. Inactive accounts are rejected the same way as bad credentials.
`keepMeLoggedIn` swaps the session TTL from `ADMIN_SESSION_TTL_HOURS` to
`ADMIN_REMEMBERED_SESSION_TTL_HOURS`.

The list endpoints accept `?limit=` — default 50, capped at 100 — and return
sanitized records including `emailNotification` status so the dashboard can show which
notifications failed.

Password changes require `currentPassword`, `newPassword`, and `confirmPassword`. New
passwords must be 8–72 characters and contain a lowercase letter, uppercase letter,
number, and special character, and must differ from the current password.

Profile images must be a `data:image/png|jpeg|webp;base64,...` URL of 1 MB or less.
They are stored inline on the admin document, so keep `REQUEST_BODY_LIMIT` above the
image limit.

## Data Model

| Collection | Contents |
| --- | --- |
| `admins` | Name, lowercased unique email, bcrypt hash, role, status, optional profile image |
| `admin_sessions` | SHA-256 hash of the token, `adminId`, `lastUsedAt`, `expiresAt` (TTL index removes expired rows) |
| `delivery_requests` | Submission fields plus `status` and `emailNotification` |
| `information_requests` | Submission fields plus `status` and `emailNotification` |

Session tokens are 32 random bytes, base64url-encoded, and only the hash is stored —
a database dump cannot be replayed as a login.

Admin roles are `super_admin`, `manager`, `dispatcher`, `viewer`; statuses are
`active` and `inactive`. Only `active` admins can authenticate. Roles are stored but
not yet enforced per endpoint — any active admin can call every admin route.

## Environment

Create a local `.env` file using `.env.example` as the template.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5050` | Listen port |
| `HOST` | `127.0.0.1` | Bind address (use `0.0.0.0` on Render) |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `REQUEST_BODY_LIMIT` | `2mb` | JSON and urlencoded body size limit |
| `MONGODB_URI` | — | **Required.** Connection string |
| `MONGODB_DB_NAME` | `efficient_global` | Database name |
| `RESEND_API_KEY` | — | **Required** for emails to send |
| `EMAIL_FROM` | — | **Required.** Verified sender, e.g. `Efficient Global <no-reply@example.com>` |
| `EMAIL_TO` | `abongsjoel@gmail.com` | Comma-separated notification recipients |
| `DELIVERY_REQUEST_EMAIL_SUBJECT` | `New delivery request submission` | Subject line |
| `REQUEST_INFORMATION_EMAIL_SUBJECT` | `New request information submission` | Subject line |
| `ADMIN_SESSION_COOKIE_NAME` | `efficient_global_admin_session` | Session cookie name |
| `ADMIN_SESSION_TTL_HOURS` | `8` | Normal session lifetime |
| `ADMIN_REMEMBERED_SESSION_TTL_HOURS` | `72` | "Keep me logged in" lifetime |
| `ADMIN_COOKIE_SAME_SITE` | `lax`, or `none` when `NODE_ENV=production` | Cookie `SameSite` |
| `ADMIN_COOKIE_SECURE` | `false`, or `true` when `NODE_ENV=production` | Cookie `Secure` flag |

Notes:

- Use commas in `CORS_ORIGIN` to allow multiple frontend origins, such as local Vite
  and the production site. Requests with no `Origin` header (curl, health checks) are
  always allowed.
- Use commas in `EMAIL_TO` to send each notification to multiple inboxes.
- In production, `EMAIL_FROM` must use a sender address on a domain verified in
  Resend, or Resend rejects the send and the endpoint returns `502`.
- Setting `ADMIN_COOKIE_SAME_SITE=none` forces `Secure` on regardless of
  `ADMIN_COOKIE_SECURE`, because browsers reject insecure cross-site cookies.

The seeder additionally requires, and only reads at seed time:

```bash
ADMIN_SEED_NAME="Jane Doe"
ADMIN_SEED_EMAIL=jane@efficientgloba.com
ADMIN_SEED_PASSWORD='choose-a-strong-password'
```

## Seeding the First Admin

There is no signup endpoint — the first account is created from the command line.

```bash
ADMIN_SEED_NAME="Jane Doe" \
ADMIN_SEED_EMAIL=jane@efficientgloba.com \
ADMIN_SEED_PASSWORD='choose-a-strong-password' \
npm run seed:admin
```

The account is created with the `super_admin` role and `active` status. Re-running is
safe: if an admin already exists for that email the script logs a skip and exits
without changes. The username used at login is the part of the email before the `@`
(`jane` in the example above).

## Deployment (Render)

- Build command `npm install`, start command `npm start`.
- Set `HOST=0.0.0.0` so Render can route traffic to the process.
- Set every required variable from the table above in the Render dashboard; `.env` is
  git-ignored and is not deployed.
- The frontend and backend live on different domains, so cross-site cookies are
  required for admin login:

  ```bash
  ADMIN_COOKIE_SAME_SITE=none
  ADMIN_COOKIE_SECURE=true
  ```

  After changing these values, redeploy the backend and sign in again so the browser
  receives a fresh session cookie.
- Add the production frontend origins to `CORS_ORIGIN`; a missing origin surfaces as a
  CORS error in the browser rather than a server log.
- Verify a deploy with `GET /health/db` — it is the only check that proves MongoDB
  credentials and network access are correct.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Process exits at startup | `MONGODB_URI` missing or unreachable; check the logged error |
| `502` on a form submit | Resend rejected the send — check `RESEND_API_KEY` and that `EMAIL_FROM` uses a verified domain. The submission is still saved with `emailNotification.status: "failed"` |
| Browser CORS error | Origin not listed in `CORS_ORIGIN` |
| Admin login succeeds but `/me` returns `401` | Cookie not stored — cross-site setup needs `ADMIN_COOKIE_SAME_SITE=none` and HTTPS, and the frontend must send credentials |
| `413` on profile image upload | Image exceeds `REQUEST_BODY_LIMIT`; images over 1 MB are rejected with `400` regardless |
