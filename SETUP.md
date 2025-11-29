# Environment Variables Setup

## Local Development

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Get your Supabase credentials:
   - Go to your Supabase project dashboard: https://supabase.com/dashboard
   - Navigate to **Settings** → **API**
   - Copy the following values:
     - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **KEEP THIS SECRET**

3. Edit `.env.local` and paste your values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

4. Restart your Next.js dev server:
   ```bash
   npm run dev
   ```

## Production (Vercel)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:
   - `NEXT_PUBLIC_SUPABASE_URL` (Production, Preview, Development)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production, Preview, Development)
   - `SUPABASE_SERVICE_ROLE_KEY` (Production, Preview, Development) ⚠️ **KEEP THIS SECRET**

4. Redeploy your application

## Security Notes

- ⚠️ **NEVER** commit `.env.local` to Git (it's already in `.gitignore`)
- ⚠️ **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- ⚠️ The service role key has admin privileges - treat it like a password
- ✅ The anon key is safe to use in client-side code
- ✅ The project URL is safe to expose

## Current Project

Your Supabase project URL: `https://xnyszubcycvvdkznltcu.supabase.co`

Get your keys from: https://supabase.com/dashboard/project/xnyszubcycvvdkznltcu/settings/api

