import { supabase } from './supabase';

export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface TranscriptSegment {
  speaker: 'A' | 'B'; // A = Agent, B = Contact
  text: string;
  start_ms: number;
  end_ms: number;
}

export interface Transcript {
  id: string;
  contact_id: string;
  message_id: string;
  user_id?: string; // UUID of the user who owns this transcript
  created_at: string;
  duration_seconds: number;
  sentiment: Sentiment;
  sentiment_score: number; // 0-100
  summary: string;
  action_items: string[];
  full_text: string;
  speakers: TranscriptSegment[];
  audio_url?: string;
  status: 'processing' | 'completed' | 'failed';
}

// Read all transcripts
export async function getAllTranscripts(): Promise<Transcript[]> {
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transcripts:', error);
    throw error;
  }

  return data || [];
}

// Get transcripts by contact ID
export async function getTranscriptsByContactId(contactId: string): Promise<Transcript[]> {
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transcripts by contact ID:', error);
    throw error;
  }

  return data || [];
}

// Get transcript by message ID
export async function getTranscriptByMessageId(messageId: string): Promise<Transcript | null> {
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('message_id', messageId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching transcript by message ID:', error);
    throw error;
  }

  return data;
}

// Save a new transcript (insert or update)
export async function saveTranscript(transcript: Transcript): Promise<Transcript> {
  // Try to upsert (insert or update if exists)
  const { data, error } = await supabase
    .from('transcripts')
    .upsert(transcript, {
      onConflict: 'message_id',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving transcript:', error);
    throw error;
  }

  return data;
}

// Update transcript status
export async function updateTranscriptStatus(
  messageId: string,
  status: 'processing' | 'completed' | 'failed'
): Promise<Transcript | null> {
  const { data, error } = await supabase
    .from('transcripts')
    .update({ status })
    .eq('message_id', messageId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error updating transcript status:', error);
    throw error;
  }

  return data;
}

// Delete a transcript
export async function deleteTranscript(messageId: string): Promise<boolean> {
  const { error } = await supabase
    .from('transcripts')
    .delete()
    .eq('message_id', messageId);

  if (error) {
    console.error('Error deleting transcript:', error);
    return false;
  }

  return true;
}

// Get unique contact IDs that have transcripts
export async function getContactIdsWithTranscripts(): Promise<string[]> {
  const { data, error } = await supabase
    .from('transcripts')
    .select('contact_id')
    .not('contact_id', 'is', null);

  if (error) {
    console.error('Error fetching contact IDs with transcripts:', error);
    throw error;
  }

  // Get unique contact IDs
  const uniqueContactIds = [...new Set((data || []).map(t => t.contact_id))];
  return uniqueContactIds;
}

