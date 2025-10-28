import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/calls
 * Fetch call recordings for a specific contact
 *
 * Query params:
 * - contactId: Required - The contact ID to fetch calls for
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error?.message },
        { status: auth.error?.status || 401 }
      );
    }

    const accessToken = process.env.GHL_ACCESS_TOKEN;
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing HighLevel credentials. Please check your .env.local file.' },
        { status: 500 }
      );
    }

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId query parameter is required' },
        { status: 400 }
      );
    }

    // Step 1: Get conversations for this contact
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
      console.error('HighLevel API Error:', conversationsResponse.status, errorText);
      return NextResponse.json(
        { error: `HighLevel API error: ${conversationsResponse.status}`, details: errorText },
        { status: conversationsResponse.status }
      );
    }

    const conversationsData = await conversationsResponse.json();
    const conversations = conversationsData.conversations || [];

    console.log(`[Calls API] Found ${conversations.length} conversations for contact ${contactId}`);

    // Step 2: For each conversation, get messages and filter for calls with recordings
    const callRecordings = [];
    let totalMessages = 0;
    let callMessages = 0;

    for (const conversation of conversations) {
      try {
        const messagesResponse = await fetch(
          `https://services.leadconnectorhq.com/conversations/${conversation.id}/messages?limit=100`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Version': '2021-07-28',
              'Content-Type': 'application/json'
            },
            cache: 'no-store'
          }
        );

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();

          // HighLevel API returns messages in a nested structure
          // Response: { messages: { messages: [...] } }
          const messages = messagesData.messages?.messages || messagesData.messages || [];
          totalMessages += messages.length;

          // Log all message types to help debug
          const messageTypes = messages.map((m: any) => m.messageType || m.type);
          console.log(`[Calls API] Conversation ${conversation.id}: ${messages.length} messages, types:`, [...new Set(messageTypes)]);

          // Filter for call messages - check messageType field (not type)
          const calls = messages.filter((msg: any) => {
            const isCall = msg.messageType === 'TYPE_CALL';

            if (isCall) {
              callMessages++;
              console.log(`[Calls API] Found call message:`, {
                id: msg.id,
                type: msg.type,
                messageType: msg.messageType,
                attachments: msg.attachments,
                direction: msg.direction,
                status: msg.status,
                meta: msg.meta,
                altId: msg.altId
              });
            }

            return isCall;
          });

          callRecordings.push(...calls.map((call: any) => ({
            id: call.id,
            conversationId: conversation.id,
            dateAdded: call.dateAdded,
            direction: call.direction,
            status: call.status,
            duration: call.meta?.call?.duration,
            // Note: Call recordings might not have attachments immediately
            // They may need to be fetched separately using the message ID
            audioUrl: call.attachments?.[0]?.url || null,
            body: call.body,
            altId: call.altId
          })));
        }
      } catch (err) {
        console.error(`Error fetching messages for conversation ${conversation.id}:`, err);
      }
    }

    console.log(`[Calls API] Summary: ${totalMessages} total messages, ${callMessages} call messages, ${callRecordings.length} with recordings`);

    // Sort by date descending (newest first)
    callRecordings.sort((a, b) => 
      new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
    );

    return NextResponse.json({
      calls: callRecordings,
      total: callRecordings.length,
      contactId
    });

  } catch (error) {
    console.error('Error fetching calls:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch calls', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

