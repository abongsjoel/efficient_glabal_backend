# Efficient Global Backend

Standalone Express API for the Efficient Global app.

## Scripts

```bash
npm install
npm run dev
```

The server defaults to `http://127.0.0.1:5050`.

## Environment

Create a local `.env` file using `.env.example` as the template.

```bash
CORS_ORIGIN=http://localhost:5173,https://efficientgloba.com,https://www.efficientgloba.com
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM="Efficient Global <onboarding@resend.dev>"
EMAIL_TO=abongsjoel@gmail.com,info@efficientgloba.com
DELIVERY_REQUEST_EMAIL_SUBJECT=New delivery request submission
REQUEST_INFORMATION_EMAIL_SUBJECT=New request information submission
```

Use commas in `CORS_ORIGIN` to allow multiple frontend origins, such as local Vite and the production site.

Use commas in `EMAIL_TO` to send each request notification to multiple inboxes.

For production, `EMAIL_FROM` should use a sender address on a domain verified in Resend.

For Render production admin login, use cross-site cookie settings because the frontend and backend are on different domains:

```bash
ADMIN_COOKIE_SAME_SITE=none
ADMIN_COOKIE_SECURE=true
```

After changing these values, redeploy the backend and sign in again so the browser receives a fresh session cookie.

## Health Check

```bash
curl http://127.0.0.1:5050/health
```
