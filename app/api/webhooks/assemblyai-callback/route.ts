import { NextRequest, NextResponse } from 'next/server';
import { saveTranscript } from '@/lib/db';

/**
 * Webhook endpoint for AssemblyAI transcription completion callbacks
 * 
 * To use this webhook:
 * 1. Deploy your app to get a public URL
 * 2. When submitting transcription to AssemblyAI, include:
 *    webhook_url: "https://yourdomain.com/api/webhooks/assemblyai-callback"
 * 
 * AssemblyAI will POST to this endpoint when transcription is complete with:
 * {
 *   "transcript_id": "...",
 *   "status": "completed" | "error"
 * }
 */

interface AssemblyAIWebhookPayload {
  transcript_id: string;
  status: 'completed' | 'error';
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
  }>;
  chapters?: Array<{
    summary: string;
    headline: string;
    gist: string;
    start: number;
    end: number;
  }>;
  auto_highlights_result?: {
    status: string;
    results: Array<{
      text: string;
      count: number;
      rank: number;
    }>;
  };
  audio_duration?: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;

    if (!apiKey) {
      console.error('Missing AssemblyAI API key');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const payload: AssemblyAIWebhookPayload = await request.json();
    
    console.log('📥 AssemblyAI webhook received:', payload);

    const { transcript_id, status } = payload;

    if (!transcript_id) {
      return NextResponse.json(
        { error: 'Missing transcript_id' },
        { status: 400 }
      );
    }

    // Fetch the full transcript from AssemblyAI
    console.log('🔍 Fetching transcript details from AssemblyAI...');
    const transcriptResponse = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcript_id}`,
      {
        headers: {
          'authorization': apiKey
        }
      }
    );

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      console.error('❌ Failed to fetch transcript:', transcriptResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch transcript from AssemblyAI' },
        { status: transcriptResponse.status }
      );
    }

    const transcript: AssemblyAITranscript = await transcriptResponse.json();

    console.log('📄 Transcript status:', transcript.status);

    // Handle error status
    if (transcript.status === 'error') {
      console.error('❌ Transcription failed:', transcript.error);
      
      // Try to update the transcript in DB to failed status
      // We need to find it by transcript_id (which is stored as 'id' in our DB)
      const allTranscripts = await import('@/lib/db').then(m => m.getAllTranscripts());
      const existingTranscript = allTranscripts.find(t => t.id === transcript_id);
      
      if (existingTranscript) {
        await saveTranscript({
          ...existingTranscript,
          status: 'failed',
          summary: `Transcription failed: ${transcript.error || 'Unknown error'}`
        });
      }

      return NextResponse.json({
        success: false,
        error: transcript.error,
        transcript_id
      });
    }

    // Only process completed transcripts
    if (transcript.status !== 'completed') {
      console.log('⏳ Transcript not yet completed, status:', transcript.status);
      return NextResponse.json({
        success: true,
        message: 'Transcript not yet completed',
        status: transcript.status
      });
    }

    // Transform the AssemblyAI data to our app's format
    console.log('🔄 Transforming transcript data...');

    const speakers = (transcript.utterances || []).map((utterance) => ({
      speaker: utterance.speaker === 'A' ? 'A' as const : 'B' as const,
      text: utterance.text,
      start_ms: utterance.start,
      end_ms: utterance.end
    }));

    // Calculate overall sentiment
    const sentimentResults = transcript.sentiment_analysis_results || [];
    const sentimentCounts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
    sentimentResults.forEach(result => {
      sentimentCounts[result.sentiment]++;
    });
    
    const overallSentiment = 
      sentimentCounts.POSITIVE > sentimentCounts.NEGATIVE ? 'POSITIVE' :
      sentimentCounts.NEGATIVE > sentimentCounts.POSITIVE ? 'NEGATIVE' : 'NEUTRAL';
    
    const sentimentScore = Math.round(
      (sentimentCounts.POSITIVE / Math.max(sentimentResults.length, 1)) * 100
    );

    // Extract action items from highlights
    const actionItems = (transcript.auto_highlights_result?.results || [])
      .slice(0, 5)
      .map(highlight => highlight.text);

    // Generate summary from chapters or use the text
    const summary = transcript.chapters && transcript.chapters.length > 0
      ? transcript.chapters.map(ch => ch.summary).join(' ')
      : transcript.text?.substring(0, 500) || 'No summary available';

    // Find the existing transcript in our DB to get contact_id and message_id
    const allTranscripts = await import('@/lib/db').then(m => m.getAllTranscripts());
    const existingTranscript = allTranscripts.find(t => t.id === transcript_id);

    if (!existingTranscript) {
      console.warn('⚠️ No existing transcript found in DB for ID:', transcript_id);
      // We can't save it without contact_id and message_id
      return NextResponse.json({
        success: false,
        error: 'No existing transcript record found',
        transcript_id
      });
    }

    // Update the transcript with completed data
    const updatedTranscript = {
      id: transcript_id,
      contact_id: existingTranscript.contact_id,
      message_id: existingTranscript.message_id,
      created_at: existingTranscript.created_at,
      duration_seconds: Math.round((transcript.audio_duration || 0) / 1000),
      sentiment: overallSentiment as 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE',
      sentiment_score: sentimentScore,
      summary,
      action_items: actionItems,
      full_text: transcript.text || '',
      speakers,
      audio_url: existingTranscript.audio_url,
      status: 'completed' as const
    };

    console.log('💾 Saving completed transcript to database...');
    await saveTranscript(updatedTranscript);

    console.log('✅ Transcript saved successfully!');

    return NextResponse.json({
      success: true,
      transcript_id,
      message: 'Transcript processed and saved successfully'
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process webhook', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Allow GET for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'AssemblyAI Webhook Endpoint',
    status: 'active',
    instructions: 'This endpoint receives POST requests from AssemblyAI when transcriptions complete'
  });
}

