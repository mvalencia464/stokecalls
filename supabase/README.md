# Supabase Setup Guide

This guide will help you set up Supabase as the database for StokeCalls.

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Click **"New Project"**
4. Fill in the details:
   - **Name**: `stokecalls` (or your preferred name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose the closest region to your users
   - **Pricing Plan**: Free tier is sufficient

## Step 2: Run the Database Schema

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Copy the contents of `supabase/schema.sql` and paste it into the editor
4. Click **"Run"** to execute the SQL

This will create:
- `transcripts` table with all necessary columns
- Indexes for fast queries
- Row Level Security (RLS) policies

## Step 3: Get Your API Credentials

1. In Supabase, go to **Settings** → **API** (left sidebar)
2. Copy the following values:

   - **Project URL**: `https://xxxxx.supabase.co`
   - **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)

   ⚠️ **Important**: Use the **service_role** key, NOT the **anon** key!

## Step 4: Add Environment Variables

### For Local Development:

1. Open your `.env.local` file
2. Add these lines:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### For Netlify Deployment:

1. Go to your Netlify dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add these variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = `your_service_role_key_here`

## Step 5: Test the Connection

Run the app locally:

```bash
npm run dev
```

Try transcribing a call. The transcript should now be saved to Supabase instead of `/tmp`.

## Step 6: Verify Data in Supabase

1. Go to **Table Editor** in Supabase
2. Click on the **transcripts** table
3. You should see your transcripts appearing here!

## Database Schema

The `transcripts` table has the following structure:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `contact_id` | TEXT | HighLevel contact ID |
| `message_id` | TEXT | HighLevel message ID (unique) |
| `created_at` | TIMESTAMPTZ | When the transcript was created |
| `duration_seconds` | INTEGER | Call duration in seconds |
| `sentiment` | TEXT | Overall sentiment (POSITIVE/NEUTRAL/NEGATIVE) |
| `sentiment_score` | INTEGER | Sentiment score (0-100) |
| `summary` | TEXT | AI-generated summary |
| `action_items` | JSONB | Array of action items |
| `full_text` | TEXT | Full transcript text |
| `speakers` | JSONB | Array of speaker segments |
| `audio_url` | TEXT | URL to the audio file |
| `status` | TEXT | processing/completed/failed |

## Troubleshooting

### Error: "Missing Supabase environment variables"

Make sure you've added both:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

to your `.env.local` file (local) and Netlify environment variables (production).

### Error: "relation 'transcripts' does not exist"

You need to run the SQL schema. Go to Step 2 above.

### Error: "new row violates row-level security policy"

The RLS policy should allow all operations. Check that the policy was created correctly in the SQL Editor.

## Next Steps

Once Supabase is working:

1. ✅ Transcripts persist across deployments
2. ✅ You can query transcripts from anywhere
3. ✅ You can build analytics dashboards
4. ✅ You can add real-time features (Supabase supports real-time subscriptions!)

Consider adding:
- User authentication (Supabase Auth)
- Real-time transcript updates
- Analytics queries
- Backup/export functionality

