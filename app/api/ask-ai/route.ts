import { NextRequest, NextResponse } from 'next/server';
import { getTranscriptByMessageId } from '@/lib/db';
import { askAboutTranscript } from '@/lib/gemini';
import { requireAuth } from '@/lib/auth';

interface AskAIRequest {
  messageId: string;
  question: string;
  conversationHistory?: Array<{ role: 'user' | 'ai'; text: string }>;
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
    const body: AskAIRequest = await request.json();
    const { messageId, question, conversationHistory = [] } = body;

    if (!messageId || !question) {
      return NextResponse.json(
        { error: 'messageId and question are required' },
        { status: 400 }
      );
    }

    // Fetch the transcript from the database
    const transcript = await getTranscriptByMessageId(messageId);

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    if (transcript.status !== 'completed') {
      return NextResponse.json(
        { error: 'Transcript is still processing. Please wait for it to complete.' },
        { status: 400 }
      );
    }

    // Use Gemini to answer the question
    const answer = await askAboutTranscript(
      question,
      transcript.full_text,
      transcript.speakers,
      conversationHistory
    );

    return NextResponse.json({
      success: true,
      answer,
      messageId
    });

  } catch (error) {
    console.error('Error in ask-ai:', error);
    return NextResponse.json(
      {
        error: 'Failed to process question',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

