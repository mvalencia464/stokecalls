import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAllTranscripts, getContactIdsWithTranscripts } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { error: auth.error?.message || 'Not authenticated' },
        { status: auth.error?.status || 401 }
      );
    }

    // Get all transcripts
    const transcripts = await getAllTranscripts();
    
    // Get unique contact IDs
    const contactIds = await getContactIdsWithTranscripts();

    // Group transcripts by contact
    const transcriptsByContact = transcripts.reduce((acc, t) => {
      if (!acc[t.contact_id]) {
        acc[t.contact_id] = [];
      }
      acc[t.contact_id].push({
        message_id: t.message_id,
        created_at: t.created_at,
        summary: t.summary?.substring(0, 100) + '...'
      });
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      total_transcripts: transcripts.length,
      unique_contact_ids: contactIds.length,
      contact_ids: contactIds,
      transcripts_by_contact: transcriptsByContact,
      sample_transcripts: transcripts.slice(0, 5).map(t => ({
        id: t.id,
        contact_id: t.contact_id,
        message_id: t.message_id,
        created_at: t.created_at,
        summary: t.summary?.substring(0, 100)
      }))
    });

  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debug info', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

