# VacciTrack

A Vercel-ready animal vaccination monitoring dashboard built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Local setup

1. Install Node.js 20 or later.
2. Install dependencies:

```bash
npm install
```

3. Create a Supabase project at [supabase.com](https://supabase.com).
4. Open the Supabase SQL Editor and run `supabase/schema.sql`.
5. Copy `.env.example` to `.env.local` and add the project URL and anon key from Supabase Project Settings > API.
6. Start the app:

```bash
npm run dev
```

Open http://localhost:3000.

## Publish With Supabase and Vercel

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/schema.sql`.
3. In **Authentication > Users**, create the first user.
4. In **SQL Editor**, create the matching staff profile, replacing the values:

```sql
insert into public.profiles (id, full_name, role)
select id, 'Maria Cruz', 'admin'
from auth.users
where email = 'admin@example.com';
```

5. In **Authentication > URL Configuration**, add the local URL and the final Vercel URL to the allowed redirect URLs:
	- `http://localhost:3000`
	- `https://your-project.vercel.app`

### 2. Publish the Next.js app

1. Put this folder in its own Git repository, or import it as the Vercel project root. The Vercel **Root Directory** must be `robotograhv2-vercel` if importing the parent workspace repository.
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Keep the framework preset as **Next.js** and the build command as `npm run build`.
4. Add these Vercel environment variables for **Production**, **Preview**, and **Development**:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

5. Deploy. Open the Vercel URL and sign in with the Supabase Auth user created above.

For CLI publishing, from this directory run `npx vercel login`, then `npx vercel --prod`. Set the two environment variables in the Vercel project settings before deploying.

The dashboard starts in demo mode when Supabase variables are absent, so it can be shown immediately. When the variables are present and an authenticated user can read `animals`, it loads live records and derives the summary metrics from them. The registration form inserts into Supabase; without Supabase configured, a registration is kept in the browser session for demonstration.

For a live demo, create an Auth user, add a matching `profiles` row with an `admin`, `veterinarian`, or `bhw` role, then sign in through the dashboard. Anonymous Supabase sessions are sent to the sign-in screen and cannot register records because of RLS.

## Security notes

- Never expose a Supabase service-role key in browser code or `NEXT_PUBLIC_*` variables.
- Keep Row Level Security enabled on every public table.
- Configure Supabase Auth redirect URLs for both localhost and the Vercel deployment URL.
