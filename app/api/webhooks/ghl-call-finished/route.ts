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
    let messageId = body.messageId || body.message_id || body.message?.id || body.id;
    const locationId = body.locationId || body.location_id || body.location?.id;
    const type = body.type || 'CallFinished'; // Default to CallFinished if not provided

    console.log('📋 Extracted fields:', { contactId, messageId, locationId, type });

    // Validate required fields (we need at least contactId and locationId)
    if (!contactId || !locationId) {
      console.error('❌ Missing required fields:', { contactId, locationId, body });
      return NextResponse.json(
        {
          error: 'Missing required fields: contactId and locationId',
          received: { contactId, locationId },
          fullPayload: body
        },
        { status: 400 }
      );
    }

    // If messageId is missing, we'll need to fetch it from HighLevel
    // This happens when using "Call Finished" trigger instead of "Message Received"
    if (!messageId) {
      console.log('⚠️ messageId not in webhook payload, will fetch from HighLevel after getting user settings');
    }
    
    console.log(`✅ Processing call for contact ${contactId}`);

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

    let supabase;
    try {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
      console.log('✅ Supabase client created');
    } catch (error) {
      console.error('❌ Failed to create Supabase client:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to initialize database connection',
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }

    // Find the user with this locationId
    let settings;
    try {
      const { data, error: settingsError } = await supabase
        .from('client_settings')
        .select('*')
        .eq('ghl_location_id', locationId)
        .single();

      if (settingsError) {
        console.error('❌ Supabase query error:', settingsError);
        throw settingsError;
      }

      settings = data;

      if (!settings) {
        console.error('❌ No settings found for locationId:', locationId);
        return NextResponse.json({
          success: false,
          error: 'No user found for this location. Please ensure your HighLevel Location ID is configured in Settings.',
          locationId
        }, { status: 404 });
      }

      console.log('✅ Found user settings for location');
    } catch (error) {
      console.error('❌ Database query failed:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to query user settings',
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }

    // If we don't have a messageId, fetch the latest call recording for this contact
    if (!messageId) {
      console.log('🔍 Fetching latest call recording for contact:', contactId);

      try {
        const messagesResponse = await fetch(
          `https://services.leadconnectorhq.com/conversations/search?contactId=${contactId}&type=Call`,
          {
            headers: {
              'Authorization': `Bearer ${settings.ghl_access_token}`,
              'Version': '2021-07-28',
              'Content-Type': 'application/json'
            }
          }
        );

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          console.log('📧 Messages response:', JSON.stringify(messagesData, null, 2));

          // Get the most recent call message
          const conversations = messagesData.conversations || [];
          if (conversations.length > 0) {
            // Sort by date and get the most recent
            const sortedConversations = conversations.sort((a: any, b: any) => {
              return new Date(b.lastMessageDate || b.dateAdded).getTime() -
                     new Date(a.lastMessageDate || a.dateAdded).getTime();
            });

            const latestConversation = sortedConversations[0];
            messageId = latestConversation.lastMessageId || latestConversation.id;
            console.log('✅ Found latest call message ID:', messageId);
          } else {
            console.error('❌ No call messages found for contact');
            return NextResponse.json({
              success: false,
              error: 'No call recordings found for this contact. The recording may not be ready yet.'
            }, { status: 404 });
          }
        } else {
          const errorText = await messagesResponse.text();
          console.error('❌ Failed to fetch messages:', messagesResponse.status, errorText);
          return NextResponse.json({
            success: false,
            error: 'Failed to fetch call recordings from HighLevel'
          }, { status: 500 });
        }
      } catch (error) {
        console.error('❌ Error fetching messages:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch call recordings'
        }, { status: 500 });
      }
    }

    // Now we should have a messageId
    console.log('📝 Final messageId:', messageId);

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
    console.error('❌ Webhook error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    let errorMessage = 'Unknown error';
    let errorDetails: any = {};

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error);
      errorDetails = error;
    } else {
      errorMessage = String(error);
    }

    console.error('❌ Error details:', errorDetails);

    return NextResponse.json(
      {
        error: 'Failed to process webhook',
        message: errorMessage,
        details: errorDetails
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

