# Azizpiz — Tema, Ghana

A MERN pizza ordering and inventory platform with customer and administrator roles.

## Quick start

1. Copy `server/.env.example` to `server/.env` and configure MongoDB plus optional SMTP/Razorpay test keys.
2. Run `npm run install:all`.
3. Start MongoDB, then run `npm run seed` to provision stock and the admin account.
4. Run `npm run dev`, and open `http://localhost:5173`.

The seeded admin account uses the credentials specified by `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` (the supplied development defaults are safe only for local use).

## Important integration notes

- Email delivery is enabled only when SMTP values are configured. In development, verification/reset URLs are logged by the API.
- Razorpay is used only if both Razorpay keys are configured. Without them, the checkout presents a clearly labelled local test-success flow for exercising the order workflow.
- Stock is decremented atomically only after a verified/simulated successful payment. The low-stock schedule runs hourly; the threshold is configurable per inventory item.

## API overview

- `POST /api/auth/register`, `/login`, `/forgot-password`, `/reset-password`, `GET /verify-email/:token`
- `GET /api/catalog`, `GET /api/orders/my`, `POST /api/orders/checkout`, `POST /api/orders/verify`
- Admin: `/api/admin/inventory`, `/api/admin/orders`, `/api/admin/orders/:id/status`

For production, supply secure secrets, HTTPS, a real SMTP provider, a Razorpay webhook endpoint, a persistent frontend URL and a monitored MongoDB deployment.
