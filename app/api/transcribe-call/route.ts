import { NextRequest, NextResponse } from 'next/server';
import { saveTranscript } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

interface TranscribeCallRequest {
  messageId: string;
  contactId?: string;
}

export async function POST(request: NextRequest) {
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

    // Step 1: Get message metadata to get locationId
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
    const message = messageData.message || messageData;
    const locationId = message.locationId;

    if (!locationId) {
      return NextResponse.json(
        { error: 'No locationId found in message' },
        { status: 400 }
      );
    }

    console.log('✅ Found locationId:', locationId);

    // Step 2: Download the audio file from HighLevel
    console.log('📥 Downloading audio from HighLevel...');
    const recordingResponse = await fetch(
      `https://services.leadconnectorhq.com/conversations/messages/${messageId}/locations/${locationId}/recording`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (!recordingResponse.ok) {
      const errorText = await recordingResponse.text();
      console.error('Failed to fetch recording:', recordingResponse.status, errorText);
      return NextResponse.json(
        {
          error: 'No audio recording found',
          details: 'The recording could not be downloaded from HighLevel. This could mean:\n\n' +
                   '1. Call recording is not enabled in HighLevel settings\n' +
                   '2. The recording is still processing (wait 30-60 seconds after call ends)\n' +
                   '3. The call was too short to generate a recording\n\n' +
                   'Please check your HighLevel settings and try again in a minute.',
          debug: {
            messageId,
            locationId,
            status: recordingResponse.status
          }
        },
        { status: 404 }
      );
    }

    // Get the audio file as a buffer
    const audioBuffer = await recordingResponse.arrayBuffer();
    console.log('✅ Downloaded audio file:', audioBuffer.byteLength, 'bytes');

    // Step 3: Upload to AssemblyAI
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
      console.error('AssemblyAI upload failed:', uploadResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to upload audio to AssemblyAI', details: errorText },
        { status: uploadResponse.status }
      );
    }

    const uploadData = await uploadResponse.json();
    const audioUrl = uploadData.upload_url;
    console.log('✅ Uploaded to AssemblyAI:', audioUrl);

    // Step 4: Send to our transcription endpoint
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

    // Step 5: The transcript is already saved by /api/transcribe
    // We don't need to save it again here - just return the response
    console.log('Transcript already saved by /api/transcribe');

    return NextResponse.json({
      success: true,
      messageId,
      contactId,
      audioUrl,
      transcript: transcriptData.transcript
    });

  } catch (error) {
    console.error('Error in transcribe-call:', error);
    console.error('Error type:', typeof error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    // Better error serialization
    let errorMessage = 'Unknown error';
    let errorDetails = {};

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error);
      errorDetails = error;
    } else {
      errorMessage = String(error);
    }

    console.error('Serialized error:', errorMessage);

    return NextResponse.json(
      {
        error: 'Failed to transcribe call',
        details: errorMessage,
        debug: errorDetails
      },
      { status: 500 }
    );
  }
}

