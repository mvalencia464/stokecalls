import { NextRequest, NextResponse } from 'next/server';
import { saveTranscript, getTranscriptByMessageId, type Transcript } from '@/lib/db';
import { analyzeTranscript } from '@/lib/gemini';
import { getClientSettings } from '@/lib/client-settings';

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

/**
 * Helper function to post transcript summary to HighLevel contact notes
 */
async function postTranscriptToHighLevel(
  contactId: string,
  transcript: Transcript,
  baseUrl: string
): Promise<void> {
  try {
    // Get the client settings to retrieve the access token
    // We need to find the user_id from the transcript's contact
    // For now, we'll use the environment variable as fallback
    const accessToken = process.env.GHL_ACCESS_TOKEN;

    if (!accessToken) {
      console.warn('⚠️ No HighLevel access token found, skipping note posting');
      return;
    }

    // Format the note with call summary, sentiment, and action items
    const sentimentEmoji =
      transcript.sentiment === 'POSITIVE' ? '😊' :
      transcript.sentiment === 'NEGATIVE' ? '😟' : '😐';

    const dashboardUrl = `${baseUrl}/callrecordings`;

    const noteBody = `
📞 Call Transcript Summary

${sentimentEmoji} Sentiment: ${transcript.sentiment} (${transcript.sentiment_score}/100)
⏱️ Duration: ${Math.floor(transcript.duration_seconds / 60)}m ${transcript.duration_seconds % 60}s

📝 Summary:
${transcript.summary}

${transcript.action_items.length > 0 ? `✅ Action Items:
${transcript.action_items.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}` : ''}

🔗 View full transcript and AI insights: ${dashboardUrl}
    `.trim();

    // Post to HighLevel contact notes
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}/notes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          body: noteBody
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to post note to HighLevel:', response.status, errorText);
      throw new Error(`HighLevel API error: ${response.status}`);
    }

    console.log('✅ Successfully posted note to HighLevel contact');
  } catch (error) {
    console.error('❌ Error posting to HighLevel:', error);
    throw error;
  }
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

    // Use Gemini API for AI analysis (cheaper than AssemblyAI's features)
    console.log('🤖 Analyzing transcript with Gemini AI...');
    const analysis = await analyzeTranscript(
      transcript.text || '',
      speakers
    );

    console.log('✅ Gemini analysis complete:', {
      sentiment: analysis.sentiment,
      sentiment_score: analysis.sentiment_score,
      action_items_count: analysis.action_items.length,
      summary_length: analysis.summary.length
    });

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

    // Update the transcript with completed data (using Gemini analysis)
    const updatedTranscript = {
      id: transcript_id,
      contact_id: existingTranscript.contact_id,
      message_id: existingTranscript.message_id,
      created_at: existingTranscript.created_at,
      duration_seconds: Math.round((transcript.audio_duration || 0) / 1000),
      sentiment: analysis.sentiment,
      sentiment_score: analysis.sentiment_score,
      summary: analysis.summary,
      action_items: analysis.action_items,
      full_text: transcript.text || '',
      speakers,
      audio_url: existingTranscript.audio_url,
      status: 'completed' as const
    };

    console.log('💾 Saving completed transcript to database...');
    await saveTranscript(updatedTranscript);

    console.log('✅ Transcript saved successfully!');

    // Step 6: Post summary back to HighLevel contact notes
    try {
      console.log('📝 Posting summary to HighLevel contact notes...');
      await postTranscriptToHighLevel(
        existingTranscript.contact_id,
        updatedTranscript,
        request.nextUrl.origin
      );
      console.log('✅ Summary posted to HighLevel successfully!');
    } catch (noteError) {
      // Don't fail the whole request if posting to HighLevel fails
      console.error('⚠️ Failed to post to HighLevel notes:', noteError);
    }

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

