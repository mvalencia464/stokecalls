import { NextRequest, NextResponse } from 'next/server';
import { getAllTranscripts, getTranscriptsByContactId } from '@/lib/db';

/**
 * GET /api/transcripts
 * Fetch transcripts, optionally filtered by contactId
 * 
 * Query params:
 * - contactId: Filter transcripts by contact ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');
    
    let transcripts;
    
    if (contactId) {
      transcripts = await getTranscriptsByContactId(contactId);
    } else {
      transcripts = await getAllTranscripts();
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

