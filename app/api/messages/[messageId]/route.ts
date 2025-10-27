import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const accessToken = process.env.GHL_ACCESS_TOKEN;
    const messageId = params.messageId;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing HighLevel credentials. Please check your .env.local file.' },
        { status: 500 }
      );
    }

    // Fetch specific message from HighLevel API
    const response = await fetch(
      `https://services.leadconnectorhq.com/conversations/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HighLevel API Error:', response.status, errorText);
      return NextResponse.json(
        { error: `HighLevel API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const message = await response.json();
    
    // Extract audio URL if this is a call recording
    const audioUrl = message.attachments?.[0]?.url || null;
    const isCall = message.type === 'TYPE_CALL';

    return NextResponse.json({
      id: message.id,
      type: message.type,
      direction: message.direction,
      status: message.status,
      dateAdded: message.dateAdded,
      body: message.body,
      attachments: message.attachments || [],
      audioUrl,
      isCall,
      hasRecording: isCall && !!audioUrl
    });

  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json(
      { error: 'Failed to fetch message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

