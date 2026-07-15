# Efficient Global Backend

Standalone Express API for the Efficient Global app.

## Scripts

```bash
npm install
npm run dev
```

The server defaults to `http://localhost:5000`.

## Environment

Create a local `.env` file using `.env.example` as the template.

```bash
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM="Efficient Global <onboarding@resend.dev>"
EMAIL_TO=abongsjoel@gmail.com,info@efficientgloba.com
DELIVERY_REQUEST_EMAIL_SUBJECT=New delivery request submission
REQUEST_INFORMATION_EMAIL_SUBJECT=New request information submission
```

Use commas in `EMAIL_TO` to send each request notification to multiple inboxes.

For production, `EMAIL_FROM` should use a sender address on a domain verified in Resend.

## Health Check

```bash
curl http://localhost:5000/health
```
