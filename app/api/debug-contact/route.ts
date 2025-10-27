import { NextRequest, NextResponse } from 'next/server';

/**
 * DEBUG ENDPOINT - Get all data for a contact to debug call recordings
 * GET /api/debug-contact?contactId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = process.env.GHL_ACCESS_TOKEN;
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing HighLevel credentials' },
        { status: 500 }
      );
    }

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId query parameter is required' },
        { status: 400 }
      );
    }

    const debugInfo: any = {
      contactId,
      conversations: [],
      allMessages: [],
      callMessages: [],
      messagesWithAttachments: []
    };

    // Step 1: Get conversations
    const conversationsResponse = await fetch(
      `https://services.leadconnectorhq.com/conversations/search?contactId=${contactId}&limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      }
    );

    if (!conversationsResponse.ok) {
      const errorText = await conversationsResponse.text();
      return NextResponse.json(
        { error: `HighLevel API error: ${conversationsResponse.status}`, details: errorText },
        { status: conversationsResponse.status }
      );
    }

    const conversationsData = await conversationsResponse.json();
    const conversations = conversationsData.conversations || [];
    
    debugInfo.conversationsCount = conversations.length;
    debugInfo.conversations = conversations.map((c: any) => ({
      id: c.id,
      contactId: c.contactId,
      locationId: c.locationId,
      type: c.type,
      lastMessageDate: c.lastMessageDate
    }));

    // Step 2: Get messages for each conversation
    for (const conversation of conversations) {
      try {
        const messagesUrl = `https://services.leadconnectorhq.com/conversations/${conversation.id}/messages?limit=100`;

        const messagesResponse = await fetch(messagesUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });

        debugInfo.messagesApiCall = {
          url: messagesUrl,
          status: messagesResponse.status,
          statusText: messagesResponse.statusText,
          ok: messagesResponse.ok
        };

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();

          // Store raw response for debugging
          debugInfo.rawMessagesResponse = messagesData;

          const messages = messagesData.messages || [];

          // Store all messages
          debugInfo.allMessages.push(...messages.map((m: any) => ({
            id: m.id,
            conversationId: conversation.id,
            type: m.type,
            direction: m.direction,
            status: m.status,
            dateAdded: m.dateAdded,
            body: m.body,
            attachments: m.attachments,
            hasAttachments: !!(m.attachments && m.attachments.length > 0)
          })));

          // Filter call messages
          const callMessages = messages.filter((m: any) => m.type === 'TYPE_CALL');
          debugInfo.callMessages.push(...callMessages.map((m: any) => ({
            id: m.id,
            conversationId: conversation.id,
            type: m.type,
            direction: m.direction,
            status: m.status,
            dateAdded: m.dateAdded,
            body: m.body,
            attachments: m.attachments,
            hasAttachments: !!(m.attachments && m.attachments.length > 0)
          })));

          // Filter messages with attachments
          const messagesWithAttachments = messages.filter((m: any) => 
            m.attachments && m.attachments.length > 0
          );
          debugInfo.messagesWithAttachments.push(...messagesWithAttachments.map((m: any) => ({
            id: m.id,
            conversationId: conversation.id,
            type: m.type,
            direction: m.direction,
            status: m.status,
            dateAdded: m.dateAdded,
            body: m.body,
            attachments: m.attachments
          })));
        } else {
          // Store error response
          const errorText = await messagesResponse.text();
          debugInfo.messagesApiError = {
            status: messagesResponse.status,
            statusText: messagesResponse.statusText,
            errorBody: errorText
          };
        }
      } catch (err) {
        console.error(`Error fetching messages for conversation ${conversation.id}:`, err);
        debugInfo.messagesApiException = {
          error: err instanceof Error ? err.message : String(err)
        };
      }
    }

    // Summary
    debugInfo.summary = {
      totalConversations: conversations.length,
      totalMessages: debugInfo.allMessages.length,
      totalCallMessages: debugInfo.callMessages.length,
      totalMessagesWithAttachments: debugInfo.messagesWithAttachments.length,
      callMessagesWithAttachments: debugInfo.callMessages.filter((m: any) => m.hasAttachments).length,
      messageTypes: [...new Set(debugInfo.allMessages.map((m: any) => m.type))]
    };

    return NextResponse.json(debugInfo, { status: 200 });

  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch debug info', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

