import { NextRequest, NextResponse } from 'next/server';

/**
 * DEBUG ENDPOINT - Get a single message to see its full structure
 * GET /api/debug-message?messageId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = process.env.GHL_ACCESS_TOKEN;
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing HighLevel credentials' },
        { status: 500 }
      );
    }

    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId query parameter is required' },
        { status: 400 }
      );
    }

    // Fetch the message
    const messageResponse = await fetch(
      `https://services.leadconnectorhq.com/conversations/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      return NextResponse.json(
        { 
          error: `HighLevel API error: ${messageResponse.status}`,
          details: errorText 
        },
        { status: messageResponse.status }
      );
    }

    const messageData = await messageResponse.json();

    // Try multiple endpoints to find the recording
    const message = messageData.message || messageData;
    const locationId = message.locationId;

    const recordingAttempts: any = {};

    // Attempt 1: /messages/{messageId}/locations/{locationId}/recording
    if (locationId) {
      try {
        const response = await fetch(
          `https://services.leadconnectorhq.com/conversations/messages/${messageId}/locations/${locationId}/recording`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Version': '2021-07-28',
              'Content-Type': 'application/json'
            }
          }
        );

        recordingAttempts.withLocation = {
          status: response.status,
          ok: response.ok,
          data: response.ok ? await response.json() : await response.text()
        };
      } catch (err) {
        recordingAttempts.withLocation = { error: err instanceof Error ? err.message : 'Unknown' };
      }
    }

    // Attempt 2: /messages/{messageId}/recording
    try {
      const response = await fetch(
        `https://services.leadconnectorhq.com/conversations/messages/${messageId}/recording`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          }
        }
      );

      recordingAttempts.withoutLocation = {
        status: response.status,
        ok: response.ok,
        data: response.ok ? await response.json() : await response.text()
      };
    } catch (err) {
      recordingAttempts.withoutLocation = { error: err instanceof Error ? err.message : 'Unknown' };
    }

    // Attempt 3: Check if there's a recordings array in the message
    recordingAttempts.messageFields = {
      hasRecordings: !!message.recordings,
      recordings: message.recordings,
      hasAttachments: !!message.attachments,
      attachments: message.attachments
    };

    return NextResponse.json({
      messageId,
      fullMessageData: messageData,
      recordingAttempts,
      analysis: {
        hasAttachments: !!(message.attachments && message.attachments.length > 0),
        attachmentsCount: message.attachments?.length || 0,
        messageType: message.messageType,
        type: message.type,
        altId: message.altId,
        meta: message.meta,
        direction: message.direction,
        status: message.status,
        locationId: message.locationId,
        allFields: Object.keys(message)
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in debug-message endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch message', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

