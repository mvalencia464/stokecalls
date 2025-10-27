# Quick Start Guide - Real Call Transcripts

## 🚀 Get Started in 5 Minutes

### Step 1: Verify Environment (30 seconds)

Check your `.env.local` file has these credentials:
```bash
NEXT_PUBLIC_GHL_LOCATION_ID=your_location_id
GHL_ACCESS_TOKEN=your_access_token
ASSEMBLYAI_API_KEY=your_assemblyai_key
```

### Step 2: Start the App (30 seconds)

```bash
npm run dev
```

Open http://localhost:3001

### Step 3: Test Manual Transcription (3 minutes)

1. **Select a contact** from the list
2. **Click "Call Recordings" tab** (new!)
3. **Click "Transcribe"** on any call
4. **Wait 30-60 seconds** for processing
5. **Switch to "AI Insights"** or "Transcript" tab
6. **See your real transcript!** 🎉

### Step 4: Verify Database (30 seconds)

```bash
cat data/transcripts.json
```

You should see your transcript stored in JSON format.

## ✅ That's It!

You now have:
- ✅ Real call transcripts from HighLevel
- ✅ AI-powered insights and summaries
- ✅ Searchable transcript viewer
- ✅ Database storage for all transcripts

## 🔄 Next: Set Up Automatic Transcription

### For Production (when ready to deploy):

1. **Deploy your app** (Vercel, Railway, etc.)
2. **Go to HighLevel** → Settings → Integrations → Webhooks
3. **Add webhook**:
   - URL: `https://yourdomain.com/api/webhooks/ghl-call-finished`
   - Event: `CallFinished`
4. **Done!** Calls will auto-transcribe from now on

### For Local Testing (optional):

```bash
# Install ngrok
npm install -g ngrok

# Expose localhost
ngrok http 3001

# Use the ngrok URL in HighLevel webhook settings
```

## 📚 Need More Help?

- **Full Setup Guide**: See `REAL_TRANSCRIPTS_SETUP.md`
- **Testing Guide**: See `test-setup.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`

## 🐛 Troubleshooting

### No calls showing up?
- Make sure the contact has calls in HighLevel
- Verify your HighLevel API credentials

### Transcription fails?
- Check AssemblyAI API key is valid
- Verify you have credits in AssemblyAI account
- Check browser console for errors

### Still stuck?
- Check server logs (terminal running `npm run dev`)
- Review the detailed guides in the documentation files

---

**Ready to go?** Start with Step 1 above! 🚀

