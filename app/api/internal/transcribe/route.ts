import { NextRequest, NextResponse } from 'next/server';
import { saveTranscript } from '@/lib/db';

interface InternalTranscribeRequest {
  messageId: string;
  contactId?: string;
  ghlAccessToken: string;
  userId?: string; // User ID for multi-tenant support
}

/**
 * Internal transcription endpoint
 * Called by webhooks - does not require user authentication
 * Protected by internal secret header
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal secret
    const internalSecret = request.headers.get('X-Internal-Secret');
    const expectedSecret = process.env.INTERNAL_API_SECRET || 'dev-secret';
    
    if (internalSecret !== expectedSecret) {
      console.error('❌ Invalid internal secret');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const assemblyAIKey = process.env.ASSEMBLYAI_API_KEY;

    if (!assemblyAIKey) {
      return NextResponse.json(
        { error: 'Missing AssemblyAI API key. Please contact support.' },
        { status: 500 }
      );
    }

    const body: InternalTranscribeRequest = await request.json();
    const { messageId, contactId, ghlAccessToken, userId } = body;

    if (!messageId || !ghlAccessToken) {
      return NextResponse.json(
        { error: 'messageId and ghlAccessToken are required' },
        { status: 400 }
      );
    }

    console.log('🎙️ Fetching call recording for message:', messageId);

    // Step 1: Get message metadata to get locationId
    const messageResponse = await fetch(
      `https://services.leadconnectorhq.com/conversations/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${ghlAccessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error('❌ Failed to fetch message:', messageResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch message from HighLevel', details: errorText },
        { status: messageResponse.status }
      );
    }

    const messageData = await messageResponse.json();
    console.log('📧 Message data:', messageData);

    // Step 2: Get the recording URL from the message
    const recordingUrl = messageData.message?.attachments?.[0] || messageData.attachments?.[0];
    
    if (!recordingUrl) {
      console.error('❌ No recording URL found in message');
      return NextResponse.json(
        { error: 'No recording found for this call' },
        { status: 404 }
      );
    }

    console.log('🎵 Found recording URL:', recordingUrl);

    // Step 3: Download the audio file
    console.log('📥 Downloading audio file...');
    const recordingResponse = await fetch(recordingUrl);

    if (!recordingResponse.ok) {
      console.error('❌ Failed to download recording:', recordingResponse.status);
      return NextResponse.json(
        { error: 'Failed to download recording' },
        { status: recordingResponse.status }
      );
    }

    // Get the audio file as a buffer
    const audioBuffer = await recordingResponse.arrayBuffer();
    console.log('✅ Downloaded audio file:', audioBuffer.byteLength, 'bytes');

    // Step 4: Upload to AssemblyAI
    console.log('📤 Uploading to AssemblyAI...');
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': assemblyAIKey,
        'content-type': 'application/octet-stream'
      },
      body: audioBuffer
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ AssemblyAI upload failed:', uploadResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to upload audio to AssemblyAI', details: errorText },
        { status: uploadResponse.status }
      );
    }

    const uploadData = await uploadResponse.json();
    const audioUrl = uploadData.upload_url;
    console.log('✅ Uploaded to AssemblyAI:', audioUrl);

    // Step 5: Send to our transcription endpoint
    const baseUrl = request.nextUrl.origin;
    console.log('📤 Sending to transcription endpoint:', `${baseUrl}/api/transcribe`);

    const transcribeResponse = await fetch(`${baseUrl}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioUrl,
        contactId,
        messageId,
        userId // Pass user ID for multi-tenant support
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

    return NextResponse.json({
      success: true,
      messageId,
      contactId,
      audioUrl,
      transcript: transcriptData.transcript
    });

  } catch (error) {
    console.error('❌ Error in internal transcription:', error);
    return NextResponse.json(
      { 
        error: 'Failed to transcribe audio', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

