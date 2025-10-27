import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const locationId = process.env.NEXT_PUBLIC_GHL_LOCATION_ID;
    const accessToken = process.env.GHL_ACCESS_TOKEN;
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    if (!locationId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing HighLevel credentials. Please check your .env.local file.' },
        { status: 500 }
      );
    }

    // Build query params
    const params = new URLSearchParams({
      locationId,
      limit: '50'
    });

    if (contactId) {
      params.append('contactId', contactId);
    }

    // Fetch conversations from HighLevel API
    const response = await fetch(
      `https://services.leadconnectorhq.com/conversations/search?${params.toString()}`,
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
    
    // Filter for conversations with call recordings
    const conversations = (data.conversations || []).map((conv: any) => ({
      id: conv.id,
      contactId: conv.contactId,
      lastMessageDate: conv.lastMessageDate,
      lastMessageType: conv.lastMessageType,
      unreadCount: conv.unreadCount
    }));

    return NextResponse.json({
      conversations,
      total: data.total || conversations.length
    });

  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

