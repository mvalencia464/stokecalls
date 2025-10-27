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

    return NextResponse.json({
      messageId,
      fullMessageData: messageData,
      analysis: {
        hasAttachments: !!(messageData.attachments && messageData.attachments.length > 0),
        attachmentsCount: messageData.attachments?.length || 0,
        messageType: messageData.messageType,
        type: messageData.type,
        altId: messageData.altId,
        meta: messageData.meta,
        direction: messageData.direction,
        status: messageData.status
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

