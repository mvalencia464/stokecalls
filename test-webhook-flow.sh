#!/bin/bash

# Test script for AssemblyAI webhook integration
# This script helps you verify that your webhook setup is working correctly

echo "🧪 AssemblyAI Webhook Integration Test"
echo "======================================"
echo ""

# Check if URL is provided
if [ -z "$1" ]; then
  echo "Usage: ./test-webhook-flow.sh <your-deployed-url>"
  echo "Example: ./test-webhook-flow.sh https://myapp.vercel.app"
  echo ""
  echo "For local testing with ngrok:"
  echo "  1. Start dev server: npm run dev"
  echo "  2. Start ngrok: ngrok http 3000"
  echo "  3. Run: ./test-webhook-flow.sh https://abc123.ngrok.io"
  exit 1
fi

BASE_URL=$1

echo "Testing URL: $BASE_URL"
echo ""

# Test 1: Check webhook endpoint
echo "📍 Test 1: Checking webhook endpoint..."
WEBHOOK_RESPONSE=$(curl -s "$BASE_URL/api/webhooks/assemblyai-callback")
echo "Response: $WEBHOOK_RESPONSE"

if echo "$WEBHOOK_RESPONSE" | grep -q "AssemblyAI Webhook Endpoint"; then
  echo "✅ Webhook endpoint is accessible"
else
  echo "❌ Webhook endpoint not responding correctly"
  exit 1
fi

echo ""

# Test 2: Check transcribe endpoint
echo "📍 Test 2: Checking transcribe endpoint..."
echo "Note: This will fail without valid audio URL, but we're just checking if endpoint exists"

TRANSCRIBE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/transcribe" \
  -H "Content-Type: application/json" \
  -d '{"audioUrl":"test"}' 2>&1)

if echo "$TRANSCRIBE_RESPONSE" | grep -q "error"; then
  echo "✅ Transcribe endpoint is accessible (returned expected error)"
else
  echo "⚠️  Unexpected response from transcribe endpoint"
fi

echo ""

# Test 3: Check environment variables (if running locally)
echo "📍 Test 3: Checking environment variables..."
if [ -f ".env.local" ]; then
  if grep -q "ASSEMBLYAI_API_KEY" .env.local; then
    echo "✅ ASSEMBLYAI_API_KEY found in .env.local"
  else
    echo "❌ ASSEMBLYAI_API_KEY not found in .env.local"
  fi
  
  if grep -q "GHL_ACCESS_TOKEN" .env.local; then
    echo "✅ GHL_ACCESS_TOKEN found in .env.local"
  else
    echo "❌ GHL_ACCESS_TOKEN not found in .env.local"
  fi
else
  echo "⚠️  .env.local not found (this is OK if testing deployed app)"
fi

echo ""
echo "======================================"
echo "✅ Basic tests complete!"
echo ""
echo "Next steps:"
echo "1. Make sure your app is deployed to: $BASE_URL"
echo "2. Open the app and select a contact"
echo "3. Go to 'Call Recordings' tab"
echo "4. Click 'Transcribe' on a call"
echo "5. Wait 30-60 seconds and refresh"
echo "6. Check server logs for webhook activity"
echo ""
echo "To monitor webhooks in real-time:"
echo "  - Vercel: vercel logs --follow"
echo "  - Railway: railway logs"
echo "  - Or check your platform's dashboard"

