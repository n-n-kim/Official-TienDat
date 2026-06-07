# Cloudflare Worker API

Worker nay cung cap cac route chat tuong thich voi frontend hien tai:

- `GET /api/chat/conversations`
- `POST /api/chat/conversations`
- `GET /api/chat/conversations/:id`
- `PUT /api/chat/conversations/:id`
- `GET /api/chat/conversations/:id/messages`
- `POST /api/chat/conversations/:id/messages`

## 1. Cai dependencies

```bash
cd worker-api
npm install
```

## 2. Tao D1 database

```bash
npx wrangler d1 create official-tiendat-chat
```

Lay `database_id` tra ve roi thay vao `wrangler.jsonc`.

## 3. Tao file bien moi truong local

Copy `.dev.vars.example` thanh `.dev.vars` va dien:

- `FIREBASE_PROJECT_ID`
- `ADMIN_EMAILS`
- `CORS_ORIGIN`

## 4. Chay schema

```bash
npm run db:migrate:local
```

Khi deploy:

```bash
npm run db:migrate:remote
```

## 5. Dev va deploy

```bash
npm run dev
npm run deploy
```

## 6. Cloudflare secrets / vars

Set trong Worker:

- `FIREBASE_PROJECT_ID`
- `ADMIN_EMAILS`
- `CORS_ORIGIN`

Va bind D1 database vao `DB`.
