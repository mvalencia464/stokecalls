import { NextRequest, NextResponse } from 'next/server';
import { saveTranscript } from '@/lib/db';

interface TranscribeCallRequest {
  messageId: string;
  contactId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.GHL_ACCESS_TOKEN;
    const assemblyAIKey = process.env.ASSEMBLYAI_API_KEY;

    if (!accessToken || !assemblyAIKey) {
      return NextResponse.json(
        { error: 'Missing API credentials. Please check your .env.local file.' },
        { status: 500 }
      );
    }

    const body: TranscribeCallRequest = await request.json();
    const { messageId, contactId } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    console.log('Fetching call recording for message:', messageId);

    // Step 1: Fetch the message to get the audio URL
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
      console.error('HighLevel API Error:', messageResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch message: ${messageResponse.status}`, details: errorText },
        { status: messageResponse.status }
      );
    }

    const messageData = await messageResponse.json();

    console.log('=== TRANSCRIBE CALL DEBUG ===');
    console.log('Message ID:', messageId);
    console.log('Message Type:', messageData.message?.messageType || messageData.messageType);
    console.log('Attachments:', messageData.message?.attachments || messageData.attachments);
    console.log('Full message data:', JSON.stringify(messageData, null, 2));

    // Handle nested message structure
    const message = messageData.message || messageData;
    const audioUrl = message.attachments?.[0]?.url || message.attachments?.[0];

    if (!audioUrl) {
      console.log('❌ No audio URL found in attachments');
      return NextResponse.json(
        {
          error: 'No audio recording found',
          details: 'The message does not have a recording URL in attachments. Please ensure call recording is enabled in HighLevel settings.',
          messageData: message
        },
        { status: 404 }
      );
    }

    console.log('✅ Found audio URL:', audioUrl);

    // Step 2: Send to our transcription endpoint
    const baseUrl = request.nextUrl.origin;
    console.log('📤 Sending to transcription endpoint:', `${baseUrl}/api/transcribe`);
    console.log('📤 Payload:', { audioUrl, contactId, messageId });

    const transcribeResponse = await fetch(`${baseUrl}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioUrl,
        contactId,
        messageId
      })
    });

    console.log('📥 Transcription response status:', transcribeResponse.status);

    if (!transcribeResponse.ok) {
      const errorData = await transcribeResponse.json();
      console.log('❌ Transcription error:', errorData);
      return NextResponse.json(
        { error: 'Transcription failed', details: errorData },
        { status: transcribeResponse.status }
      );
    }

    const transcriptData = await transcribeResponse.json();
    console.log('✅ Transcription successful:', transcriptData);

    console.log('Transcription completed successfully');

    // Step 3: Save transcript to database
    const savedTranscript = await saveTranscript({
      ...transcriptData,
      audio_url: audioUrl,
      status: 'completed' as const
    });

    console.log('Transcript saved to database:', savedTranscript.id);

    return NextResponse.json({
      success: true,
      messageId,
      contactId,
      audioUrl,
      transcript: savedTranscript
    });

  } catch (error) {
    console.error('Error in transcribe-call:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe call', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

