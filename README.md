# ARCenter

건축 프로젝트별 법규 자료, 대화 기록, 토지정보를 관리하는 AI 법규검토 작업공간입니다.

## Architecture

- **React + Vite**: workspace UI
- **Express**: authenticated Gemini and Airtect gateway
- **Supabase Auth**: Google sign-in
- **Supabase Postgres**: projects, folders, sessions, messages
- **Supabase Storage**: private source documents
- **Row Level Security (RLS)**: user data isolation

Uploaded files are no longer converted to Base64 or stored inside database rows. The browser uploads raw files to a private Storage bucket and stores only a `storage://` reference in project metadata.

## 1. Supabase setup

1. Create a Supabase project.
2. Open the SQL Editor.
3. Run [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql).
4. Enable the Google provider under **Authentication → Providers**.
5. Add the local and production URLs under **Authentication → URL Configuration**.

The SQL migration creates:

- `profiles`
- `groups`
- `chat_sessions`
- `chat_messages`
- private `knowledge-files` bucket
- RLS policies
- Realtime publication entries

## 2. Environment variables

Copy `.env.example` and set the values in your development and deployment environments.

Browser-safe:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
GOOGLE_MAPS_PLATFORM_KEY=
```

Server-only:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
AIRTECT_API_BASE_URL=https://api.airtect.kr
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` through Vite variables or client code.

## 3. Run locally

```bash
npm install
npm run dev
```

The app is served from `http://localhost:3000`.

## 4. Production

```bash
npm run build
NODE_ENV=production npm start
```

Configure the same environment variables in NCP. Place HTTPS in front of the Express server and keep `ALLOW_INSECURE_AIRTECT=false`.

## Security controls

- Every `/api/gemini/*` and `/api/airtect/*` request requires a valid Supabase access token.
- Gemini requests are limited per authenticated user.
- Airtect requests are limited per authenticated user.
- The old unrestricted wildcard proxy was removed.
- Client authorization headers are never forwarded to Airtect.
- JSON request bodies are limited to 2 MB.
- AI file hydration is limited to 5 files, 10 MB per file, and 20 MB total.
- Storage paths are checked against the authenticated user ID before server download.
- Gemini and Supabase service-role keys stay server-side.

## Migration note

This branch changes the persistence provider. Existing Firebase data is not copied automatically. Export or retain the Firebase project until groups, sessions, messages, and legacy Base64 files have been migrated and verified.
