# VacciTrack

A Vercel-ready animal vaccination monitoring dashboard built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Contributing

Push changes to the `staging` branch and open a pull request into `master`. Merge it from GitHub once reviewed — this keeps deploys triggered by the repo owner's own merge.

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

## Automatic SMS vaccination reminders

The Vercel cron job at `/api/cron/vaccination-alerts` runs daily and sends reminders for vaccinated animals due in 7 days, due tomorrow, and overdue. Users manage their language and channel preferences from **Profile and security**; the super-admin can also manage them from **User accounts**. English is the default language; SMS and email reminders are enabled by default. SMS is sent through Semaphore and email through Gmail SMTP when the account has a valid destination. Failed or stale in-progress deliveries are retried on later runs, and scheduled deliveries are queued before sending so unfinished work can resume.

Run the current `supabase/schema.sql` before deploying these changes. It adds profile preferences and a reminder type to delivery records while preserving existing deduplication history. Each attempted delivery records its recipient, message, attempt count, status, and provider error/message ID in `vaccination_alerts`; keep database access restricted.

Configure these server-side environment variables in Vercel:

```text
CRON_SECRET=long-random-secret
SEMAPHORE_API_KEY=your-semaphore-api-key
# Optional — must be a sender name registered with Semaphore.
SEMAPHORE_SENDER_NAME=your-registered-sender-name
GMAIL_USER=your-gmail-address@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
# Optional — defaults to both "sms,email"; use "none" to pause automatic sends.
REMINDER_CHANNELS=sms,email
# Optional localization for the barangay and clinic name in reminder messages.
BARANGAY_NAME=Barangay Estefania
CLINIC_INFO=the barangay health station
```

Set the optional sender name only if it is registered with Semaphore; otherwise, Semaphore uses the account default. `SMS_API_URL` may override the Semaphore endpoint and must use HTTPS. Use a Google App Password for Gmail SMTP. Keep these values server-side and never use `NEXT_PUBLIC_*` variables for SMS or email credentials. The scheduled job runs at 16:00 UTC, which is midnight in the Philippines. The endpoint processes a bounded number of deliveries concurrently and reports SMS encoding and segment counts.

Test targeting and message generation without sending or writing delivery/notification records by calling `/api/cron/vaccination-alerts?dryRun=1` with the same `Authorization: Bearer <CRON_SECRET>` header used by the scheduled job. The response includes recipient previews, language, SMS encoding/segments, and per-channel summaries; protect the cron secret because the preview includes contact information.

Admins and BHWs can also use **SMS messaging** in the workspace, and the super-admin dashboard has the same feature. It sends a custom message to one active client or to active clients with vaccinated animals due in exactly 7 days. The recipient preview must be confirmed before sending. This manual message is separate from the scheduled reminder.

The super-admin SMS page also has separate **Test SMS** and **Test Email** forms for sending test messages to a phone number or email address you control. The message is prefilled with a sample and can be edited; confirm before sending.

## Staff email messaging

Admins and BHWs can send a custom email from **Email messaging** to one active client or active clients with vaccinated animals due in exactly 7 days. A recipient preview must be confirmed before sending. Emails are sent individually through Gmail SMTP, and a batch is limited to 100 recipients.

Run the current `supabase/schema.sql` and configure these server-side environment variables in Vercel or `.env.local`. The same Gmail credentials are used for automatic reminders and manual email messaging:

```text
GMAIL_USER=your-gmail-address@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
```

Use a Google App Password (with 2-Step Verification enabled), not your normal Gmail password. Keep both values server-side and never use `NEXT_PUBLIC_*` variables for SMTP credentials. Only clients with a valid, non-placeholder email address on their account can receive messages.

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

For a live demo, create an Auth user, add a matching `profiles` row with an `admin` or `bhw` role, then sign in through the dashboard. Anonymous Supabase sessions are sent to the sign-in screen and cannot register records because of RLS.

## Security notes

- Never expose a Supabase service-role key in browser code or `NEXT_PUBLIC_*` variables.
- Keep Row Level Security enabled on every public table.
- Configure Supabase Auth redirect URLs for both localhost and the Vercel deployment URL.
