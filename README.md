# ARCenter

건축 프로젝트별 법규 자료, 대화 기록, 토지정보를 관리하는 AI 법규검토 작업공간입니다.

## Architecture

- **React + Vite**: workspace UI
- **Express**: authenticated OpenAI and Airtect gateway
- **OpenAI Responses API**: legal review, document routing, structured outputs, optional web search
- **Supabase Auth**: passwordless email magic-link sign-in
- **Supabase Postgres**: projects, folders, sessions, messages
- **Supabase Storage**: private source documents
- **Row Level Security (RLS)**: user data isolation

The login screen is loaded before the full workspace bundle. The main workspace is downloaded only after Supabase confirms an authenticated session.

Uploaded files are no longer converted to Base64 or stored inside database rows. The browser uploads raw files to a private Storage bucket and stores only a `storage://` reference in project metadata. Selected files are downloaded by the authenticated server and sent to OpenAI only for the active request.

## 1. Supabase setup

1. Create a Supabase project.
2. Open the SQL Editor.
3. Run [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql).
4. Keep the Email provider enabled under **Authentication → Providers**.
5. Add local and production URLs under **Authentication → URL Configuration**.

No Google Cloud OAuth project is required. Users enter an email address and receive a one-time sign-in link from Supabase.

The SQL migration creates:

- `profiles`
- `groups`
- `chat_sessions`
- `chat_messages`
- private `knowledge-files` bucket
- RLS policies
- Realtime publication entries

## 2. Environment variables

Copy `.env.example` and set the values in development and deployment environments.

Browser-safe:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Server-only:

```bash
SUPABASE_URL=
SUPABASE_SECRET_KEY=
# Legacy fallback is also supported:
# SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
AIRTECT_API_BASE_URL=https://api.airtect.kr
```

Never expose `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `OPENAI_API_KEY` through Vite variables or client code.

Google Maps is not used by the current application and no Maps key is required.

## 3. Authentication URL setup

For local development:

```text
Site URL: http://localhost:3000
Redirect URL: http://localhost:3000/**
```

For the current production deployment:

```text
Site URL: https://law.airtect.kr
Redirect URL: https://law.airtect.kr/**
```

The login form passes the current browser origin to Supabase as the email redirect destination.

## 4. Run locally

```bash
npm install
npm run dev
```

The app is served from `http://localhost:3000`.

## 5. Production

```bash
npm run build
NODE_ENV=production npm start
```

Configure the same environment variables in NCP. Place HTTPS in front of the Express server and keep `ALLOW_INSECURE_AIRTECT=false`.

## AI routes

The browser uses authenticated `/api/ai/*` routes. `/api/gemini/*` remains as a temporary backwards-compatible alias for previously cached browser bundles.

- `/api/ai/generate`
- `/api/ai/select-documents`
- `/api/ai/suggestions`
- `/api/ai/extract-principles`
- `/api/ai/analyze-address`

The optional web-search toggle maps to the OpenAI Responses API `web_search` tool.

## Security controls

- Every `/api/ai/*`, compatibility `/api/gemini/*`, and `/api/airtect/*` request requires a valid Supabase access token.
- AI requests are limited per authenticated user.
- Airtect requests are limited per authenticated user.
- The old unrestricted wildcard proxy was removed.
- Client authorization headers are never forwarded to Airtect.
- JSON request bodies are limited to 2 MB.
- AI file hydration is limited to 5 files, 10 MB per file, and 20 MB total.
- Storage paths are checked against the authenticated user ID before server download.
- OpenAI and Supabase secret keys stay server-side.
- Responses API calls use `store: false`.

## Migration note

This branch changes the persistence and AI providers. Existing Firebase data is not copied automatically. Export or retain the Firebase project until groups, sessions, messages, and legacy Base64 files have been migrated and verified.
