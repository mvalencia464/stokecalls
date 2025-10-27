# AssemblyAI Webhook Integration Guide

## 🎉 What Changed?

Your transcription system has been **upgraded from polling to webhooks**! This is a much better approach that solves several critical issues.

## ❌ Problems with Old Polling Approach

1. **Timeout Issues** - Polling had a 3-minute timeout, but longer calls could take more time
2. **Resource Intensive** - Kept API routes open, consuming server resources
3. **Not Scalable** - Multiple simultaneous transcriptions could overwhelm your server
4. **Serverless Limitations** - Vercel and similar platforms have execution time limits (10-60 seconds)
5. **Inefficient** - Constantly checking status every 3 seconds wastes API calls

## ✅ Benefits of Webhook Approach

✅ **Instant Response** - API returns immediately after submitting transcription  
✅ **No Timeouts** - AssemblyAI notifies you when done, regardless of duration  
✅ **Scalable** - Can handle unlimited simultaneous transcriptions  
✅ **Serverless-Friendly** - No long-running processes  
✅ **Efficient** - Only one API call when transcription completes  

## 🏗️ Architecture Overview

### Old Flow (Polling)
```
1. Submit audio to AssemblyAI
2. Wait 3 seconds
3. Check status
4. If not done, repeat steps 2-3 (up to 60 times)
5. Return result or timeout
```

### New Flow (Webhooks)
```
1. Submit audio to AssemblyAI with webhook URL
2. Save placeholder transcript (status: "processing")
3. Return immediately to user
4. [Later] AssemblyAI calls your webhook when done
5. Webhook updates transcript (status: "completed")
6. User sees completed transcript
```

## 📁 Files Modified/Created

### New Files
- **`app/api/webhooks/assemblyai-callback/route.ts`** - Receives completion notifications from AssemblyAI

### Modified Files
- **`app/api/transcribe/route.ts`** - Now uses webhooks instead of polling

## 🚀 Setup Instructions

### Step 1: Deploy Your App

You **must** deploy your app to a public URL for webhooks to work. Local development won't work unless you use ngrok (see Testing section).

**Recommended Platforms:**
- [Vercel](https://vercel.com) (easiest for Next.js)
- [Railway](https://railway.app)
- [Render](https://render.com)
- [Fly.io](https://fly.io)

### Step 2: Verify Webhook Endpoint

After deployment, test your webhook endpoint:

```bash
curl https://yourdomain.com/api/webhooks/assemblyai-callback
```

You should see:
```json
{
  "message": "AssemblyAI Webhook Endpoint",
  "status": "active",
  "instructions": "This endpoint receives POST requests from AssemblyAI when transcriptions complete"
}
```

### Step 3: Test a Transcription

1. Open your deployed app
2. Select a contact with call recordings
3. Go to "Call Recordings" tab
4. Click "Transcribe" on any call
5. You should see "Transcription in progress..." immediately
6. Wait 30-60 seconds (depending on call length)
7. Refresh the page - transcript should be completed!

## 🔄 How It Works

### When You Click "Transcribe"

1. **`/api/transcribe-call`** fetches the audio URL from HighLevel
2. **`/api/transcribe`** submits to AssemblyAI with:
   ```json
   {
     "audio_url": "https://...",
     "webhook_url": "https://yourdomain.com/api/webhooks/assemblyai-callback",
     "speaker_labels": true,
     "sentiment_analysis": true,
     ...
   }
   ```
3. AssemblyAI returns immediately with:
   ```json
   {
     "id": "transcript_123",
     "status": "queued"
   }
   ```
4. Your app saves a placeholder transcript:
   ```json
   {
     "id": "transcript_123",
     "status": "processing",
     "summary": "Transcription in progress...",
     ...
   }
   ```
5. User sees "Transcription in progress..."

### When AssemblyAI Finishes

1. AssemblyAI POSTs to your webhook:
   ```json
   {
     "transcript_id": "transcript_123",
     "status": "completed"
   }
   ```
2. Your webhook fetches the full transcript from AssemblyAI
3. Transforms the data to your app's format
4. Updates the database with completed transcript
5. User refreshes and sees the completed transcript!

## 🧪 Testing Locally with ngrok

Webhooks require a public URL. For local testing, use ngrok:

### Install ngrok
```bash
npm install -g ngrok
# or
brew install ngrok
```

### Start Your Dev Server
```bash
npm run dev
```

### Expose Localhost
```bash
ngrok http 3000
```

You'll see:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

### Update Your Code Temporarily

In `app/api/transcribe/route.ts`, temporarily hardcode the webhook URL:

```typescript
// For local testing only - remove before deploying!
const webhookUrl = 'https://abc123.ngrok.io/api/webhooks/assemblyai-callback';
```

Now test transcriptions - AssemblyAI will call your local server via ngrok!

**Remember to remove this before deploying!**

## 🐛 Troubleshooting

### Transcription Stuck on "Processing"?

**Check webhook endpoint:**
```bash
curl https://yourdomain.com/api/webhooks/assemblyai-callback
```

**Check server logs:**
- Look for "📥 AssemblyAI webhook received"
- If you don't see this, AssemblyAI isn't calling your webhook

**Verify your deployed URL:**
- Make sure your app is publicly accessible
- Check that the URL in the transcribe request is correct

### Webhook Returns 500 Error?

**Check AssemblyAI API key:**
```bash
# In your deployed environment
echo $ASSEMBLYAI_API_KEY
```

**Check database permissions:**
- Make sure the `/data` directory is writable
- For production, consider using a real database (PostgreSQL/Supabase)

### Transcription Fails?

**Check AssemblyAI dashboard:**
- Go to https://www.assemblyai.com/app/transcripts
- Find your transcript ID
- Check for errors

**Common issues:**
- Invalid audio URL (not publicly accessible)
- Audio format not supported
- API quota exceeded

## 📊 Monitoring

### Check Webhook Logs

In your deployment platform (Vercel, Railway, etc.), check logs for:

```
✅ Transcription submitted successfully!
📋 Transcript ID: abc123
🔔 Webhook will be called at: https://yourdomain.com/api/webhooks/assemblyai-callback
```

Later, you should see:
```
📥 AssemblyAI webhook received: { transcript_id: 'abc123', status: 'completed' }
🔍 Fetching transcript details from AssemblyAI...
📄 Transcript status: completed
🔄 Transforming transcript data...
💾 Saving completed transcript to database...
✅ Transcript saved successfully!
```

### AssemblyAI Dashboard

Monitor your transcriptions at:
https://www.assemblyai.com/app/transcripts

## 🔐 Security (Optional)

For production, you may want to verify webhook authenticity. AssemblyAI supports webhook secrets:

### Add Webhook Secret

In `.env.local`:
```bash
ASSEMBLYAI_WEBHOOK_SECRET=your-secret-here
```

### Update Transcribe Endpoint

In `app/api/transcribe/route.ts`:
```typescript
const webhookSecret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;

body: JSON.stringify({
  audio_url: audioUrl,
  webhook_url: webhookUrl,
  webhook_auth_header_name: 'X-AssemblyAI-Secret',
  webhook_auth_header_value: webhookSecret,
  // ... other options
})
```

### Verify in Webhook

In `app/api/webhooks/assemblyai-callback/route.ts`:
```typescript
const secret = request.headers.get('X-AssemblyAI-Secret');
const expectedSecret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;

if (secret !== expectedSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

## 🎯 Next Steps

1. ✅ Deploy your app to a public URL
2. ✅ Test the webhook endpoint
3. ✅ Transcribe a test call
4. ✅ Verify completion via webhook
5. 🔄 Set up HighLevel webhook for automatic transcription
6. 🔄 Consider migrating to PostgreSQL/Supabase for production
7. 🔄 Add error monitoring (Sentry, LogRocket)
8. 🔄 Implement webhook security with secrets

## 📚 Related Documentation

- [AssemblyAI Webhook Docs](https://www.assemblyai.com/docs/deployment/webhooks)
- [AssemblyAI API Reference](https://www.assemblyai.com/docs/api-reference)
- [REAL_TRANSCRIPTS_SETUP.md](./REAL_TRANSCRIPTS_SETUP.md)
- [HIGHLEVEL_INTEGRATION_GUIDE.md](./HIGHLEVEL_INTEGRATION_GUIDE.md)

## 💡 Tips

- **Refresh the page** after transcription starts to see completed results
- **Check the database** (`/data/transcripts.json`) to see all transcripts
- **Monitor logs** in your deployment platform for debugging
- **Use ngrok** for local testing with webhooks
- **Consider real-time updates** with WebSockets or polling from the frontend

---

**Questions?** Check the server logs or AssemblyAI dashboard for detailed error messages.

