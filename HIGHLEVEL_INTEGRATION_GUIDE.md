# HighLevel API Integration Guide

## 🔑 Getting Your Credentials

### 1. Location ID
1. Log into your HighLevel account
2. Go to Settings → Business Profile
3. Copy your Location ID (format: `xxxxxxxxxxxxxxxxxxxxxxxx`)

### 2. Private Registration Access Token
1. Visit: https://marketplace.gohighlevel.com/oauth/chooselocation
2. Select your location
3. Authorize the app
4. Copy the access token (starts with `Bearer ...`)

---

## 📡 Key HighLevel API Endpoints

### Base URL
```
https://services.leadconnectorhq.com
```

### Authentication Header
```javascript
headers: {
  'Authorization': `Bearer ${process.env.GHL_ACCESS_TOKEN}`,
  'Version': '2021-07-28',
  'Content-Type': 'application/json'
}
```

### Important Endpoints

#### 1. Get Contacts
```
GET /contacts/
Query params:
  - locationId: your_location_id
  - limit: 100
  - skip: 0
```

#### 2. Get Contact by ID
```
GET /contacts/{contactId}
```

#### 3. Get Conversations
```
GET /conversations/search
Query params:
  - locationId: your_location_id
  - contactId: contact_id (optional)
```

#### 4. Get Message (for call recording)
```
GET /conversations/messages/{messageId}
Response includes:
  - attachments: [{ url: "audio_file_url" }]
  - type: "TYPE_CALL"
```

#### 5. Add Note to Contact
```
POST /contacts/{contactId}/notes
Body:
{
  "body": "Call Summary: ...",
  "userId": "your_user_id"
}
```

---

## 🎣 Webhook Setup

### Available Webhooks
- `CallFinished` - Triggered when a call ends
- `ContactCreate` - New contact created
- `ContactUpdate` - Contact updated
- `ConversationUnreadUpdate` - New message

### Webhook Payload Example (CallFinished)
```json
{
  "type": "CallFinished",
  "locationId": "xxx",
  "contactId": "xxx",
  "messageId": "xxx",
  "conversationId": "xxx",
  "userId": "xxx",
  "direction": "inbound",
  "duration": 450,
  "timestamp": "2023-10-26T14:30:00Z"
}
```

### Setting Up Webhooks
1. Go to HighLevel Settings → Integrations → Webhooks
2. Add webhook URL: `https://yourdomain.com/api/webhooks/ghl-call-finished`
3. Select events: `CallFinished`
4. Save and test

---

## 🔄 Example Integration Flow

### Step 1: Create Webhook Handler
```typescript
// app/api/webhooks/ghl-call-finished/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const payload = await request.json();
  
  const { contactId, messageId, locationId } = payload;
  
  // 1. Fetch the call recording URL
  const messageResponse = await fetch(
    `https://services.leadconnectorhq.com/conversations/messages/${messageId}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.GHL_ACCESS_TOKEN}`,
        'Version': '2021-07-28'
      }
    }
  );
  
  const messageData = await messageResponse.json();
  const audioUrl = messageData.attachments?.[0]?.url;
  
  if (!audioUrl) {
    return NextResponse.json({ error: 'No audio found' }, { status: 400 });
  }
  
  // 2. Send to transcription service (AssemblyAI)
  const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'authorization': process.env.ASSEMBLYAI_API_KEY!,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: true,
      auto_chapters: true,
      sentiment_analysis: true,
      entity_detection: true
    })
  });
  
  const { id: transcriptId } = await transcriptResponse.json();
  
  // 3. Poll for completion (or use webhook)
  // 4. Store in database
  // 5. Generate AI insights
  // 6. Post back to GHL contact notes
  
  return NextResponse.json({ success: true, transcriptId });
}
```

### Step 2: Fetch Contacts
```typescript
// app/api/contacts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const response = await fetch(
    `https://services.leadconnectorhq.com/contacts/?locationId=${process.env.NEXT_PUBLIC_GHL_LOCATION_ID}&limit=100`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.GHL_ACCESS_TOKEN}`,
        'Version': '2021-07-28'
      }
    }
  );
  
  const data = await response.json();
  return NextResponse.json(data);
}
```

### Step 3: Update Frontend to Use Real Data
```typescript
// app/callrecordings.tsx
'use client';

import { useState, useEffect } from 'react';

export default function StokeLeadsDashboard() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchContacts() {
      const response = await fetch('/api/contacts');
      const data = await response.json();
      setContacts(data.contacts || []);
      setLoading(false);
    }
    
    fetchContacts();
  }, []);
  
  // Rest of component...
}
```

---

## 🤖 AssemblyAI Integration

### Get API Key
1. Sign up at https://www.assemblyai.com/
2. Get API key from dashboard

### Transcribe Audio
```typescript
// 1. Submit for transcription
const response = await fetch('https://api.assemblyai.com/v2/transcript', {
  method: 'POST',
  headers: {
    'authorization': process.env.ASSEMBLYAI_API_KEY!,
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    audio_url: audioUrl,
    speaker_labels: true,
    auto_chapters: true,
    sentiment_analysis: true,
    auto_highlights: true,
    entity_detection: true,
    iab_categories: true
  })
});

const { id } = await response.json();

// 2. Poll for completion
let transcript;
while (true) {
  const pollResponse = await fetch(
    `https://api.assemblyai.com/v2/transcript/${id}`,
    {
      headers: {
        'authorization': process.env.ASSEMBLYAI_API_KEY!
      }
    }
  );
  
  transcript = await pollResponse.json();
  
  if (transcript.status === 'completed') break;
  if (transcript.status === 'error') throw new Error('Transcription failed');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
}

// 3. Use the transcript
const { text, words, utterances, sentiment_analysis_results } = transcript;
```

---

## 🧠 OpenAI Integration

### Generate Summary and Action Items
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function analyzeTranscript(transcriptText: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are a sales call analyst. Analyze the following call transcript and provide: 1) Executive summary, 2) Action items, 3) Overall sentiment (POSITIVE/NEUTRAL/NEGATIVE), 4) Sentiment score (0-100), 5) Key insights."
      },
      {
        role: "user",
        content: transcriptText
      }
    ],
    response_format: { type: "json_object" }
  });
  
  return JSON.parse(completion.choices[0].message.content);
}
```

---

## 🗄️ Database Setup (Supabase Example)

### 1. Create Supabase Project
- Visit https://supabase.com/
- Create new project
- Get connection string

### 2. Install Dependencies
```bash
npm install @supabase/supabase-js
```

### 3. Create Client
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### 4. Store Transcript
```typescript
const { data, error } = await supabase
  .from('transcripts')
  .insert({
    contact_id: contactId,
    message_id: messageId,
    location_id: locationId,
    full_text: transcript.text,
    summary: analysis.summary,
    action_items: analysis.action_items,
    sentiment: analysis.sentiment,
    sentiment_score: analysis.sentiment_score,
    speakers: transcript.utterances,
    duration_seconds: duration
  });
```

---

## 🚀 Deployment Checklist

- [ ] Set up production database
- [ ] Add all environment variables to hosting platform
- [ ] Configure webhook URLs in HighLevel
- [ ] Test webhook delivery
- [ ] Set up error monitoring (Sentry)
- [ ] Add rate limiting
- [ ] Add request validation
- [ ] Set up logging
- [ ] Test with real calls
- [ ] Monitor API usage and costs

---

## 📚 Resources

- **HighLevel API Docs**: https://highlevel.stoplight.io/docs/integrations/
- **AssemblyAI Docs**: https://www.assemblyai.com/docs
- **OpenAI Docs**: https://platform.openai.com/docs
- **Next.js API Routes**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- **Supabase Docs**: https://supabase.com/docs

