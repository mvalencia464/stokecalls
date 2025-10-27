import { NextRequest, NextResponse } from 'next/server';
import { saveTranscript } from '@/lib/db';

/**
 * Webhook endpoint for HighLevel "Call Finished" events
 * 
 * To set up in HighLevel:
 * 1. Go to Settings → Integrations → Webhooks
 * 2. Add webhook URL: https://yourdomain.com/api/webhooks/ghl-call-finished
 * 3. Select event: "CallFinished"
 * 4. Save and test
 * 
 * Expected payload from HighLevel:
 * {
 *   "type": "CallFinished",
 *   "locationId": "...",
 *   "contactId": "...",
 *   "messageId": "...",
 *   "direction": "inbound" | "outbound",
 *   "status": "completed",
 *   ...
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Received HighLevel webhook:', JSON.stringify(body, null, 2));
    
    const { type, contactId, messageId, locationId } = body;
    
    // Validate webhook type
    if (type !== 'CallFinished') {
      return NextResponse.json(
        { error: 'Invalid webhook type', expected: 'CallFinished', received: type },
        { status: 400 }
      );
    }
    
    // Validate required fields
    if (!contactId || !messageId) {
      return NextResponse.json(
        { error: 'Missing required fields: contactId and messageId' },
        { status: 400 }
      );
    }
    
    console.log(`Processing call for contact ${contactId}, message ${messageId}`);
    
    // Create a placeholder transcript with "processing" status
    const placeholderTranscript = {
      id: `transcript_${Date.now()}`,
      contact_id: contactId,
      message_id: messageId,
      created_at: new Date().toISOString(),
      duration_seconds: 0,
      sentiment: 'NEUTRAL' as const,
      sentiment_score: 50,
      summary: 'Processing...',
      action_items: [],
      full_text: '',
      speakers: [],
      status: 'processing' as const
    };
    
    await saveTranscript(placeholderTranscript);
    
    // Trigger transcription in the background (non-blocking)
    // We'll use the existing /api/transcribe-call endpoint
    const baseUrl = request.nextUrl.origin;
    
    // Don't await this - let it run in background
    fetch(`${baseUrl}/api/transcribe-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messageId,
        contactId
      })
    })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          console.log('Transcription completed:', data);
          
          // Save the completed transcript
          if (data.transcript) {
            await saveTranscript({
              ...data.transcript,
              status: 'completed' as const
            });
          }
        } else {
          console.error('Transcription failed:', await response.text());
          // Update status to failed
          await saveTranscript({
            ...placeholderTranscript,
            status: 'failed' as const,
            summary: 'Transcription failed'
          });
        }
      })
      .catch((error) => {
        console.error('Error triggering transcription:', error);
      });
    
    // Return immediately to HighLevel
    return NextResponse.json({
      success: true,
      message: 'Call received and queued for transcription',
      contactId,
      messageId
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process webhook', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Allow GET for webhook verification (some webhook providers require this)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'HighLevel Call Finished Webhook Endpoint',
    status: 'active',
    instructions: 'Send POST requests with CallFinished events'
  });
}

