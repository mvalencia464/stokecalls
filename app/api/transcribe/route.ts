import { NextRequest, NextResponse } from 'next/server';
import { saveTranscript } from '@/lib/db';
import { AssemblyAI } from 'assemblyai';

interface TranscribeRequest {
  audioUrl: string;
  contactId?: string;
  messageId?: string;
}

interface AssemblyAITranscript {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: string;
  }>;
  utterances?: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  sentiment_analysis_results?: Array<{
    text: string;
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    confidence: number;
    speaker?: string;
  }>;
  auto_highlights_result?: {
    status: string;
    results: Array<{
      count: number;
      rank: number;
      text: string;
      timestamps: Array<{ start: number; end: number }>;
    }>;
  };
  chapters?: Array<{
    summary: string;
    headline: string;
    gist: string;
    start: number;
    end: number;
  }>;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing AssemblyAI API key. Please check your .env.local file.' },
        { status: 500 }
      );
    }

    const body: TranscribeRequest = await request.json();
    const { audioUrl, contactId, messageId } = body;

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'audioUrl is required' },
        { status: 400 }
      );
    }

    console.log('🎙️ Starting transcription for audio:', audioUrl);

    // Initialize AssemblyAI client
    const client = new AssemblyAI({
      apiKey: apiKey
    });

    // Get the webhook URL for AssemblyAI callbacks
    const baseUrl = request.nextUrl.origin;
    const webhookUrl = `${baseUrl}/api/webhooks/assemblyai-callback`;

    console.log('🔗 Webhook URL:', webhookUrl);

    // Step 1: Submit audio for transcription with webhook using SDK
    // NOTE: We only use AssemblyAI for transcription + speaker labels
    // All AI analysis (summary, sentiment, etc.) is done with Gemini API for cost savings
    const transcript = await client.transcripts.submit({
      audio: audioUrl,
      webhook_url: webhookUrl,
      speaker_labels: true,
      speakers_expected: 2,
      // Disabled expensive features - using Gemini instead:
      // sentiment_analysis: false,
      // auto_highlights: false,
      // entity_detection: false,
      // summarization: false
    });

    const transcriptId = transcript.id;

    console.log('✅ Transcription submitted successfully!');
    console.log('📋 Transcript ID:', transcriptId);
    console.log('⏳ Status:', transcript.status);
    console.log('🔔 Webhook will be called at:', webhookUrl);

    // Step 2: Create a placeholder transcript in the database
    // The webhook will update it when transcription completes
    const placeholderTranscript = {
      id: transcriptId,
      contact_id: contactId || '',
      message_id: messageId || '',
      created_at: new Date().toISOString(),
      duration_seconds: 0,
      sentiment: 'NEUTRAL' as const,
      sentiment_score: 50,
      summary: 'Transcription in progress...',
      action_items: [],
      full_text: '',
      speakers: [],
      audio_url: audioUrl,
      status: 'processing' as const
    };

    console.log('💾 Saving placeholder transcript to database...');
    await saveTranscript(placeholderTranscript);

    console.log('✅ Placeholder saved. Transcription will complete via webhook.');

    // Return immediately - webhook will handle completion
    return NextResponse.json({
      success: true,
      transcriptId,
      status: 'processing',
      message: 'Transcription started. You will be notified when complete.',
      transcript: placeholderTranscript
    });

  } catch (error) {
    console.error('Error in transcription:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check status of a transcript
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    const { searchParams } = new URL(request.url);
    const transcriptId = searchParams.get('id');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing AssemblyAI API key' },
        { status: 500 }
      );
    }

    if (!transcriptId) {
      return NextResponse.json(
        { error: 'transcriptId is required' },
        { status: 400 }
      );
    }

    // Use SDK to get transcript
    const client = new AssemblyAI({ apiKey });
    const transcript = await client.transcripts.get(transcriptId);

    return NextResponse.json(transcript);

  } catch (error) {
    console.error('Error checking transcript status:', error);
    return NextResponse.json(
      { error: 'Failed to check transcript status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

