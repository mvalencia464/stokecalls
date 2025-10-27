# Real Call Transcripts Setup Guide

## 🎉 Overview

Your app is now fully configured to work with **real phone call transcripts** from HighLevel! This guide explains how everything works and how to set it up.

## ✅ What's Been Implemented

### 1. **Database Storage** (`lib/db.ts`)
- Simple JSON file-based database for storing transcripts
- Located in `/data/transcripts.json` (auto-created)
- Easy to migrate to PostgreSQL/Supabase later

### 2. **Webhook Endpoint** (`/api/webhooks/ghl-call-finished`)
- Receives HighLevel "Call Finished" events
- Automatically triggers transcription for new calls
- Runs in the background (non-blocking)

### 3. **API Endpoints**
- **`/api/transcripts`** - Fetch stored transcripts by contact
- **`/api/calls`** - List available call recordings for a contact
- **`/api/transcribe-call`** - Manually transcribe a specific call (now saves to DB)

### 4. **UI Updates** (`app/callrecordings.tsx`)
- Fetches real transcripts from the database
- New "Call Recordings" tab to view and manually transcribe calls
- Real-time loading states and error handling
- Automatic refresh after transcription

## 🚀 Setup Instructions

### Step 1: Environment Variables

Make sure your `.env.local` file has all required credentials:

```bash
# HighLevel API Configuration
NEXT_PUBLIC_GHL_LOCATION_ID=your_location_id_here
GHL_ACCESS_TOKEN=your_access_token_here

# AssemblyAI for transcription
ASSEMBLYAI_API_KEY=your_assemblyai_key_here

# Optional: OpenAI for enhanced AI features
OPENAI_API_KEY=your_openai_key_here
```

### Step 2: Test Manual Transcription

1. Start your dev server: `npm run dev`
2. Open the app and select a contact
3. Click on the **"Call Recordings"** tab
4. Click **"Transcribe"** on any available call
5. Wait for transcription to complete
6. Switch to the **"AI Insights"** or **"Transcript"** tab to view results

### Step 3: Set Up Automatic Webhooks (Production)

#### A. Deploy Your App
Deploy to Vercel, Railway, or any hosting platform that supports Next.js.

#### B. Configure HighLevel Webhook
1. Log into your HighLevel account
2. Go to **Settings → Integrations → Webhooks**
3. Click **"Add Webhook"**
4. Configure:
   - **URL**: `https://yourdomain.com/api/webhooks/ghl-call-finished`
   - **Event**: Select `CallFinished`
   - **Method**: POST
5. Save and test the webhook

#### C. Verify Webhook
Test the webhook endpoint:
```bash
curl https://yourdomain.com/api/webhooks/ghl-call-finished
```

You should see:
```json
{
  "message": "HighLevel Call Finished Webhook Endpoint",
  "status": "active",
  "instructions": "Send POST requests with CallFinished events"
}
```

## 📊 How It Works

### Automatic Flow (via Webhook)
```
1. Call finishes in HighLevel
   ↓
2. HighLevel sends webhook to /api/webhooks/ghl-call-finished
   ↓
3. Webhook creates placeholder transcript (status: "processing")
   ↓
4. Background job fetches audio URL from HighLevel
   ↓
5. Audio sent to AssemblyAI for transcription
   ↓
6. Transcript saved to database (status: "completed")
   ↓
7. UI automatically shows new transcript
```

### Manual Flow (via UI)
```
1. User clicks "Call Recordings" tab
   ↓
2. App fetches available calls from HighLevel
   ↓
3. User clicks "Transcribe" on a call
   ↓
4. App fetches audio URL and sends to AssemblyAI
   ↓
5. Transcript saved to database
   ↓
6. UI refreshes and shows new transcript
```

## 🗄️ Database Schema

Current JSON structure in `/data/transcripts.json`:

```typescript
interface Transcript {
  id: string;                    // Unique transcript ID
  contact_id: string;            // HighLevel contact ID
  message_id: string;            // HighLevel message ID (unique)
  created_at: string;            // ISO timestamp
  duration_seconds: number;      // Call duration
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  sentiment_score: number;       // 0-100
  summary: string;               // AI-generated summary
  action_items: string[];        // Extracted action items
  full_text: string;             // Full transcript text
  speakers: TranscriptSegment[]; // Speaker-labeled segments
  audio_url?: string;            // Original audio URL
  status: 'processing' | 'completed' | 'failed';
}
```

## 🔄 Migrating to PostgreSQL/Supabase (Optional)

When you're ready for production, you can migrate to a real database:

### Option A: Supabase
```bash
npm install @supabase/supabase-js
```

Create table:
```sql
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_seconds INTEGER,
  sentiment TEXT,
  sentiment_score INTEGER,
  summary TEXT,
  action_items JSONB,
  full_text TEXT,
  speakers JSONB,
  audio_url TEXT,
  status TEXT DEFAULT 'processing'
);

CREATE INDEX idx_contact_id ON transcripts(contact_id);
CREATE INDEX idx_created_at ON transcripts(created_at DESC);
```

### Option B: PostgreSQL
Update `lib/db.ts` to use `pg` or Prisma instead of JSON files.

## 🧪 Testing

### Test Webhook Locally (using ngrok)
```bash
# Install ngrok
npm install -g ngrok

# Start your dev server
npm run dev

# In another terminal, expose localhost
ngrok http 3000

# Use the ngrok URL in HighLevel webhook settings
# Example: https://abc123.ngrok.io/api/webhooks/ghl-call-finished
```

### Test Manual Transcription
1. Make a test call in HighLevel
2. Open your app
3. Navigate to a contact
4. Go to "Call Recordings" tab
5. Click "Transcribe" on the test call
6. Verify transcript appears in other tabs

## 📝 API Endpoints Reference

### GET `/api/transcripts`
Fetch transcripts for a contact
```bash
curl "http://localhost:3000/api/transcripts?contactId=c_001"
```

### GET `/api/calls`
List call recordings for a contact
```bash
curl "http://localhost:3000/api/calls?contactId=c_001"
```

### POST `/api/transcribe-call`
Manually transcribe a call
```bash
curl -X POST http://localhost:3000/api/transcribe-call \
  -H "Content-Type: application/json" \
  -d '{"messageId": "msg_123", "contactId": "c_001"}'
```

### POST `/api/webhooks/ghl-call-finished`
Webhook endpoint (called by HighLevel)
```bash
curl -X POST http://localhost:3000/api/webhooks/ghl-call-finished \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CallFinished",
    "contactId": "c_001",
    "messageId": "msg_123",
    "locationId": "loc_123"
  }'
```

## 🐛 Troubleshooting

### No transcripts showing up?
1. Check that you have real calls in HighLevel for the contact
2. Verify your API credentials in `.env.local`
3. Check browser console for errors
4. Check server logs for API errors

### Transcription fails?
1. Verify AssemblyAI API key is valid
2. Check that the call has an audio recording attached
3. Ensure the audio URL is accessible
4. Check AssemblyAI dashboard for quota/errors

### Webhook not working?
1. Verify webhook URL is correct in HighLevel
2. Check that your app is deployed and accessible
3. Test webhook endpoint with curl
4. Check HighLevel webhook logs for delivery status

## 🎯 Next Steps

1. ✅ Test manual transcription with real calls
2. ✅ Deploy to production
3. ✅ Set up HighLevel webhook
4. ✅ Monitor first automatic transcriptions
5. 🔄 Consider migrating to PostgreSQL for production
6. 🔄 Add error monitoring (Sentry, LogRocket)
7. 🔄 Set up email notifications for failed transcriptions

## 📚 Related Documentation

- [HighLevel API Docs](https://highlevel.stoplight.io/docs/integrations/)
- [AssemblyAI Docs](https://www.assemblyai.com/docs)
- [HIGHLEVEL_INTEGRATION_GUIDE.md](./HIGHLEVEL_INTEGRATION_GUIDE.md)
- [TESTING_SUMMARY.md](./TESTING_SUMMARY.md)

---

**Questions?** Check the console logs or review the API endpoint responses for detailed error messages.

