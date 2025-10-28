import { NextRequest, NextResponse } from 'next/server';
import { getTranscriptByMessageId, saveTranscript } from '@/lib/db';
import { analyzeTranscript } from '@/lib/gemini';
import { requireAuth } from '@/lib/auth';

interface ReanalyzeRequest {
  messageId: string;
}

/**
 * POST /api/reanalyze-transcript
 * Re-analyze an existing transcript using Gemini AI
 * This is useful when:
 * - The AI model has been updated
 * - You want to regenerate insights
 * - The original analysis failed or was incomplete
 */
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
    const body: ReanalyzeRequest = await request.json();
    const { messageId } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    console.log('🔄 Re-analyzing transcript for messageId:', messageId);

    // Fetch the existing transcript
    const transcript = await getTranscriptByMessageId(messageId);

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    if (transcript.status !== 'completed') {
      return NextResponse.json(
        { error: 'Cannot re-analyze a transcript that is not completed' },
        { status: 400 }
      );
    }

    if (!transcript.full_text || !transcript.speakers || transcript.speakers.length === 0) {
      return NextResponse.json(
        { error: 'Transcript does not have the required data (full_text and speakers)' },
        { status: 400 }
      );
    }

    // Re-analyze using Gemini
    console.log('🤖 Re-analyzing with Gemini AI...');
    const analysis = await analyzeTranscript(
      transcript.full_text,
      transcript.speakers
    );

    console.log('✅ Re-analysis complete:', {
      sentiment: analysis.sentiment,
      sentiment_score: analysis.sentiment_score,
      action_items_count: analysis.action_items.length,
      summary_length: analysis.summary.length
    });

    // Update the transcript with new analysis
    const updatedTranscript = {
      ...transcript,
      sentiment: analysis.sentiment,
      sentiment_score: analysis.sentiment_score,
      summary: analysis.summary,
      action_items: analysis.action_items
    };

    console.log('💾 Saving updated transcript...');
    await saveTranscript(updatedTranscript);

    console.log('✅ Transcript re-analyzed and saved successfully!');

    return NextResponse.json({
      success: true,
      messageId,
      transcript: updatedTranscript,
      message: 'Transcript re-analyzed successfully'
    });

  } catch (error) {
    console.error('❌ Error re-analyzing transcript:', error);
    return NextResponse.json(
      {
        error: 'Failed to re-analyze transcript',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

