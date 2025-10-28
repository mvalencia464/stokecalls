import { NextRequest, NextResponse } from 'next/server';
import { saveTranscript } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

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

    console.log('🔔 Received HighLevel webhook:', JSON.stringify(body, null, 2));

    // Extract fields - HighLevel might send them in different formats
    const contactId = body.contactId || body.contact_id || body.contact?.id;
    const messageId = body.messageId || body.message_id || body.message?.id || body.id;
    const locationId = body.locationId || body.location_id || body.location?.id;
    const type = body.type || 'CallFinished'; // Default to CallFinished if not provided

    console.log('📋 Extracted fields:', { contactId, messageId, locationId, type });

    // Validate required fields (we need at least contactId and messageId)
    if (!contactId || !messageId) {
      console.error('❌ Missing required fields:', { contactId, messageId, body });
      return NextResponse.json(
        {
          error: 'Missing required fields: contactId and messageId',
          received: { contactId, messageId },
          fullPayload: body
        },
        { status: 400 }
      );
    }
    
    console.log(`✅ Processing call for contact ${contactId}, message ${messageId}`);

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

    console.log('💾 Saving placeholder transcript...');
    await saveTranscript(placeholderTranscript);
    console.log('✅ Placeholder saved');

    // Look up user by locationId to get their GHL access token
    console.log('🔍 Looking up user by locationId:', locationId);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables');
      return NextResponse.json({
        success: false,
        error: 'Server configuration error'
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the user with this locationId
    const { data: settings, error: settingsError } = await supabase
      .from('client_settings')
      .select('*')
      .eq('ghl_location_id', locationId)
      .single();

    if (settingsError || !settings) {
      console.error('❌ Could not find user settings for locationId:', locationId, settingsError);
      return NextResponse.json({
        success: false,
        error: 'No user found for this location. Please ensure your HighLevel Location ID is configured in Settings.'
      }, { status: 404 });
    }

    console.log('✅ Found user settings for location');

    // Trigger transcription in the background (non-blocking)
    const baseUrl = request.nextUrl.origin;

    console.log('🚀 Triggering background transcription...');

    // Don't await this - let it run in background
    // We'll call a new internal endpoint that doesn't require auth
    fetch(`${baseUrl}/api/internal/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET || 'dev-secret'
      },
      body: JSON.stringify({
        messageId,
        contactId,
        ghlAccessToken: settings.ghl_access_token
      })
    })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Transcription completed:', data);
        } else {
          const errorText = await response.text();
          console.error('❌ Transcription failed:', response.status, errorText);
          // Update status to failed
          await saveTranscript({
            ...placeholderTranscript,
            status: 'failed' as const,
            summary: 'Transcription failed'
          });
        }
      })
      .catch((error) => {
        console.error('❌ Error triggering transcription:', error);
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

