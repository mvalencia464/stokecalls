# Testing Your Real Transcripts Setup

## ✅ Quick Test Checklist

### 1. Verify Server is Running
- [x] Dev server started on http://localhost:3001
- [ ] No compilation errors
- [ ] Environment variables loaded

### 2. Test API Endpoints

#### Test Transcripts Endpoint
```bash
curl http://localhost:3001/api/transcripts
```
Expected: `{"transcripts":[],"total":0}` (empty initially)

#### Test Webhook Endpoint
```bash
curl http://localhost:3001/api/webhooks/ghl-call-finished
```
Expected: 
```json
{
  "message": "HighLevel Call Finished Webhook Endpoint",
  "status": "active",
  "instructions": "Send POST requests with CallFinished events"
}
```

### 3. Test UI

1. Open http://localhost:3001 in your browser
2. You should see the contacts list (either real from HighLevel or mock data)
3. Click on a contact
4. You should see these tabs:
   - ✅ AI Insights
   - ✅ Transcript
   - ✅ Ask AI
   - ✅ **Call Recordings** (NEW!)

### 4. Test Manual Transcription

1. Click on the **"Call Recordings"** tab
2. If you have real calls in HighLevel:
   - You should see a list of call recordings
   - Click "Transcribe" on any call
   - Wait for transcription to complete
   - Switch to "AI Insights" or "Transcript" tab to see results
3. If no calls are found:
   - Make a test call in HighLevel first
   - Or use the mock data toggle to see the UI

### 5. Verify Database Storage

After transcribing a call, check:
```bash
cat data/transcripts.json
```

You should see your transcript data stored in JSON format.

## 🧪 Manual Testing Steps

### Step 1: Test with Mock Data
1. Open http://localhost:3001
2. Toggle "Use Real Data" OFF (if you don't have HighLevel set up yet)
3. Click on "Sarah Jenkins"
4. Verify all tabs work correctly
5. Note: Mock data won't have the "Call Recordings" tab functionality

### Step 2: Test with Real HighLevel Data
1. Ensure `.env.local` has valid credentials:
   - `NEXT_PUBLIC_GHL_LOCATION_ID`
   - `GHL_ACCESS_TOKEN`
   - `ASSEMBLYAI_API_KEY`
2. Toggle "Use Real Data" ON
3. Select a contact that has call recordings
4. Go to "Call Recordings" tab
5. Click "Transcribe" on a call
6. Monitor browser console for any errors
7. Wait for transcription (can take 30-60 seconds)
8. Check other tabs for the new transcript

### Step 3: Test Webhook (Advanced)

#### Using ngrok for local testing:
```bash
# Install ngrok
npm install -g ngrok

# Expose localhost
ngrok http 3001
```

Then in HighLevel:
1. Go to Settings → Integrations → Webhooks
2. Add webhook URL: `https://YOUR-NGROK-URL.ngrok.io/api/webhooks/ghl-call-finished`
3. Select event: `CallFinished`
4. Make a test call in HighLevel
5. Check your app - transcript should appear automatically!

## 🐛 Common Issues

### Issue: "No call recordings found"
**Solution:** 
- Verify the contact has actual calls in HighLevel
- Check that calls have audio recordings attached
- Verify your HighLevel API credentials

### Issue: Transcription fails
**Solution:**
- Check AssemblyAI API key is valid
- Verify you have credits in AssemblyAI account
- Check browser console for detailed error messages
- Check server logs (terminal running `npm run dev`)

### Issue: Transcripts not showing up
**Solution:**
- Check `/data/transcripts.json` exists and has data
- Verify the contact ID matches between HighLevel and your database
- Try refreshing the page
- Check browser console for API errors

### Issue: Webhook not receiving events
**Solution:**
- Verify webhook URL is correct in HighLevel
- Check that your app is accessible (use ngrok for local testing)
- Test webhook endpoint manually with curl
- Check HighLevel webhook logs for delivery status

## 📊 Expected Behavior

### First Time Setup
1. No transcripts in database (empty)
2. "Call Recordings" tab shows available calls from HighLevel
3. Manual transcription works immediately
4. Transcripts are saved and displayed

### After Webhook Setup
1. New calls automatically trigger transcription
2. Transcripts appear without manual intervention
3. UI updates when you refresh or navigate to contact

### Production
1. All calls automatically transcribed
2. Transcripts stored in database
3. Fast loading (no need to transcribe again)
4. Historical data preserved

## 🎯 Success Criteria

- [ ] Can view contacts (real or mock)
- [ ] Can see contact details
- [ ] "Call Recordings" tab appears
- [ ] Can list available call recordings
- [ ] Can manually trigger transcription
- [ ] Transcription completes successfully
- [ ] Transcript appears in "AI Insights" and "Transcript" tabs
- [ ] Data persists in `/data/transcripts.json`
- [ ] Webhook endpoint responds correctly
- [ ] No console errors

## 📝 Next Steps After Testing

1. ✅ Verify manual transcription works
2. ✅ Deploy to production (Vercel, Railway, etc.)
3. ✅ Set up HighLevel webhook with production URL
4. ✅ Test automatic transcription with real calls
5. 🔄 Monitor for errors and edge cases
6. 🔄 Consider migrating to PostgreSQL for production scale
7. 🔄 Add monitoring and alerting

---

**Ready to test?** Start with Step 1 above and work your way through! 🚀

