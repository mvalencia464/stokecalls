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

    // Try multiple ways to get the audio URL
    let audioUrl = null;

    // Method 1: Direct attachment URL
    if (message.attachments?.[0]?.url) {
      audioUrl = message.attachments[0].url;
      console.log('✅ Found audio URL in attachments[0].url');
    }
    // Method 2: Attachment as string
    else if (typeof message.attachments?.[0] === 'string') {
      audioUrl = message.attachments[0];
      console.log('✅ Found audio URL as string in attachments[0]');
    }
    // Method 3: Check meta.recording_url (some HighLevel versions)
    else if (message.meta?.recording_url) {
      audioUrl = message.meta.recording_url;
      console.log('✅ Found audio URL in meta.recording_url');
    }
    // Method 4: Check meta.call.recording_url
    else if (message.meta?.call?.recording_url) {
      audioUrl = message.meta.call.recording_url;
      console.log('✅ Found audio URL in meta.call.recording_url');
    }

    if (!audioUrl) {
      console.log('❌ No audio URL found in any location');
      console.log('Available fields:', Object.keys(message));
      console.log('Meta fields:', message.meta ? Object.keys(message.meta) : 'No meta');

      return NextResponse.json(
        {
          error: 'No audio recording found',
          details: 'The message does not have a recording URL in attachments. This could mean:\n\n' +
                   '1. Call recording is not enabled in HighLevel settings\n' +
                   '2. The recording is still processing (wait 30-60 seconds after call ends)\n' +
                   '3. The call was too short to generate a recording\n\n' +
                   'Please check your HighLevel settings and try again in a minute.',
          debug: {
            messageId,
            messageType: message.messageType || message.type,
            hasAttachments: !!message.attachments,
            attachmentsLength: message.attachments?.length || 0,
            hasMeta: !!message.meta,
            availableFields: Object.keys(message)
          }
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

