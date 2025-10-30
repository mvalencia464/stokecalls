import { NextRequest, NextResponse } from 'next/server';
import { getAllTranscripts, getTranscriptsByContactId } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/transcripts
 * Fetch transcripts, optionally filtered by contactId
 *
 * Query params:
 * - contactId: Filter transcripts by contact ID
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { error: auth.error?.message },
        { status: auth.error?.status || 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    let transcripts;

    if (contactId) {
      transcripts = await getTranscriptsByContactId(contactId, auth.user.id);
    } else {
      transcripts = await getAllTranscripts(auth.user.id);
    }

    return NextResponse.json({
      transcripts,
      total: transcripts.length
    });
    
  } catch (error) {
    console.error('Error fetching transcripts:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch transcripts', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

