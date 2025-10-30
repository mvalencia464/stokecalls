# Multi-Tenant Transcripts Fix

## Problem

The transcripts table was missing a `user_id` column, causing all transcripts from all users to be stored together without isolation. This meant:

1. When filtering contacts by "only show contacts with calls", you were seeing contact IDs from ALL users' transcripts, not just your own
2. Arthur Zard's contact ID in your HighLevel account is different from contact IDs in other users' accounts
3. The filter was showing contacts that don't exist in your HighLevel account

## Solution

Added `user_id` column to the transcripts table and updated all code to:
1. Store the user_id when creating transcripts
2. Filter transcripts by user_id when querying
3. Use Row Level Security (RLS) policies to ensure users only see their own transcripts

## Database Migration Required

**IMPORTANT:** You need to run the migration to add the `user_id` column to existing transcripts.

### Steps to Apply Migration:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **"New Query"**
4. Copy the contents of `supabase/migrations/add_user_id_to_transcripts.sql`
5. Paste and click **"Run"**

### Migration File: `supabase/migrations/add_user_id_to_transcripts.sql`

```sql
-- Add user_id column to transcripts table for multi-tenant support
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_transcripts_user_id ON transcripts(user_id);

-- Update RLS policy to filter by user_id
DROP POLICY IF EXISTS "Allow all operations on transcripts" ON transcripts;

-- Create policy to allow users to see only their own transcripts
CREATE POLICY "Users can view their own transcripts" ON transcripts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transcripts" ON transcripts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transcripts" ON transcripts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transcripts" ON transcripts
  FOR DELETE
  USING (auth.uid() = user_id);
```

### Handling Existing Transcripts

**Note:** Existing transcripts in the database will have `user_id = NULL` after running the migration. These transcripts won't be visible to any user due to the RLS policies.

If you have existing transcripts that you want to keep:

1. You need to manually assign them to the correct user
2. Run this SQL query in Supabase SQL Editor:

```sql
-- Update existing transcripts to assign them to a specific user
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID from auth.users table

UPDATE transcripts
SET user_id = 'YOUR_USER_ID_HERE'
WHERE user_id IS NULL;
```

To find your user ID:
```sql
SELECT id, email FROM auth.users;
```

## Code Changes Made

### 1. Database Schema (`supabase/schema.sql`)
- Added `user_id UUID REFERENCES auth.users(id)` column
- Added index on `user_id`
- Updated RLS policies to filter by `user_id`

### 2. TypeScript Interface (`lib/db.ts`)
- Added `user_id?: string` to the `Transcript` interface

### 3. API Endpoints Updated

#### `app/api/webhooks/ghl-call-finished/route.ts`
- Now includes `user_id: settings.user_id` when creating placeholder transcripts
- Passes `userId` to the internal transcribe endpoint

#### `app/api/transcribe-call/route.ts`
- Passes `userId: auth.user.id` to the `/api/transcribe` endpoint

#### `app/api/transcribe/route.ts`
- Accepts `userId` in the request body
- Includes `user_id: userId` when creating placeholder transcripts

#### `app/api/internal/transcribe/route.ts`
- Accepts `userId` in the request body
- Passes `userId` to the `/api/transcribe` endpoint

## Testing After Migration

1. **Run the migration** in Supabase SQL Editor
2. **Assign existing transcripts** to your user (if any)
3. **Deploy the code changes** (already pushed to GitHub)
4. **Test the filter**:
   - Go to the Contacts page
   - The "Only show contacts with call history" checkbox should be checked by default
   - You should now see ALL contacts that YOU have called (including Arthur Zard)
   - Uncheck the box to see all contacts from HighLevel

## Verification

To verify the fix is working:

1. Check the browser console for logs like:
   ```
   [Contacts API] Contact IDs with transcripts: X contacts
   [Contacts API] Successfully fetched X contacts with calls
   ```

2. Use the debug endpoint to see what's in the database:
   ```
   GET /api/debug-transcripts
   ```
   This will show you all transcripts and their associated contact IDs

3. Verify that Arthur Zard appears in the contacts list when the filter is enabled

## Future Transcripts

All new transcripts created after deploying these changes will automatically include the `user_id`, so they will be properly isolated per user.

