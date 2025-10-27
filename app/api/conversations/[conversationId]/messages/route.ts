import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const accessToken = process.env.GHL_ACCESS_TOKEN;
    const conversationId = params.conversationId;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing HighLevel credentials. Please check your .env.local file.' },
        { status: 500 }
      );
    }

    // Fetch messages from HighLevel API
    const response = await fetch(
      `https://services.leadconnectorhq.com/conversations/${conversationId}/messages?limit=100`,
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

    const data = await response.json();
    
    // Transform messages and filter for calls with recordings
    const messages = (data.messages || []).map((msg: any) => ({
      id: msg.id,
      type: msg.type,
      direction: msg.direction,
      status: msg.status,
      dateAdded: msg.dateAdded,
      body: msg.body,
      attachments: msg.attachments || [],
      // Check if this is a call with recording
      hasRecording: msg.type === 'TYPE_CALL' && msg.attachments && msg.attachments.length > 0
    }));

    // Filter to only call messages with recordings
    const callsWithRecordings = messages.filter((msg: any) => msg.hasRecording);

    return NextResponse.json({
      messages,
      callsWithRecordings,
      total: messages.length
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

