# Staff Portal (Next.js)

## Local UI testing (no Discord / Supabase)

1. From this folder: `npm install` then `npm run dev`
2. Create **`website/.env.local`**:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-dev-secret-at-least-32-characters

DEV_BYPASS_AUTH=true
NEXT_PUBLIC_DEV_BYPASS_AUTH=true
```

3. Open [http://localhost:3000](http://localhost:3000) — you are signed in as **Dev Staff** automatically.
4. All dashboard pages use **in-memory mock data** (pending users, stats, logs, blacklist, etc.). Accept/deny on Pending updates the mock state until you restart the server.

**Never** set `DEV_BYPASS_AUTH` in production.

## Full stack (Discord + Supabase + bot)

Copy variables from the repo root [`.env.example`](../.env.example) into `website/.env.local`, set `DEV_BYPASS_AUTH=false`, and run the bot from [`../bot`](../bot).

Apply database tables with [`../supabase-schema.sql`](../supabase-schema.sql) in the Supabase SQL editor.
