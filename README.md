# Management application

Next.js 16 administration application for the ecommerce API.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer
- A deployed API with a public HTTPS domain
- A deployed customer storefront with a public HTTPS domain

## Environment

Copy `.env.example` to `.env.local` for local development:

- `NEXT_PUBLIC_BASE_URL`: public API origin without `/api` or a trailing slash
- `NEXT_PUBLIC_FRONTEND_URL`: public customer-storefront origin without a trailing slash

Both values are public URLs. Never place database credentials, JWT secrets,
courier credentials, SMS credentials, or other private keys in this frontend.

The browser calls `/backend-api/*`, which Next.js proxies to the API. This keeps
the admin authentication cookie first-party. Server-rendered requests use the
API origin directly.

## Commands

```bash
npm ci
npm run lint
npm run build
npm start
```

## Coolify deployment

1. Create an application from the management GitHub repository.
2. Select **Nixpacks**. A Dockerfile is not required.
3. Leave the install, build, and start command overrides empty.
4. Expose port `3000`.
5. Add `NEXT_PUBLIC_BASE_URL` and `NEXT_PUBLIC_FRONTEND_URL` from
   `.env.example`. Make both variables available during the build because
   Next.js embeds public variables and compiles the API rewrite at build time.
6. Assign the management HTTPS domain and deploy.

The API domain must allow the management origin in `ALLOWED_ORIGINS`. Deploy the
API first, create the initial super-admin, then sign into this application with
that account's email and password.
