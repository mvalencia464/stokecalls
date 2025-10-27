import fs from 'fs/promises';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
const TRANSCRIPTS_FILE = path.join(DB_DIR, 'transcripts.json');

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

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DB_DIR);
  } catch {
    await fs.mkdir(DB_DIR, { recursive: true });
  }
}

// Ensure transcripts file exists
async function ensureTranscriptsFile() {
  await ensureDataDir();
  try {
    await fs.access(TRANSCRIPTS_FILE);
  } catch {
    await fs.writeFile(TRANSCRIPTS_FILE, JSON.stringify([], null, 2));
  }
}

// Read all transcripts
export async function getAllTranscripts(): Promise<Transcript[]> {
  await ensureTranscriptsFile();
  const data = await fs.readFile(TRANSCRIPTS_FILE, 'utf-8');
  return JSON.parse(data);
}

// Get transcripts by contact ID
export async function getTranscriptsByContactId(contactId: string): Promise<Transcript[]> {
  const transcripts = await getAllTranscripts();
  return transcripts.filter(t => t.contact_id === contactId);
}

// Get transcript by message ID
export async function getTranscriptByMessageId(messageId: string): Promise<Transcript | null> {
  const transcripts = await getAllTranscripts();
  return transcripts.find(t => t.message_id === messageId) || null;
}

// Save a new transcript
export async function saveTranscript(transcript: Transcript): Promise<Transcript> {
  const transcripts = await getAllTranscripts();
  
  // Check if transcript with this message_id already exists
  const existingIndex = transcripts.findIndex(t => t.message_id === transcript.message_id);
  
  if (existingIndex >= 0) {
    // Update existing transcript
    transcripts[existingIndex] = transcript;
  } else {
    // Add new transcript
    transcripts.push(transcript);
  }
  
  // Sort by created_at descending (newest first)
  transcripts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  await fs.writeFile(TRANSCRIPTS_FILE, JSON.stringify(transcripts, null, 2));
  return transcript;
}

// Update transcript status
export async function updateTranscriptStatus(
  messageId: string, 
  status: 'processing' | 'completed' | 'failed'
): Promise<Transcript | null> {
  const transcripts = await getAllTranscripts();
  const index = transcripts.findIndex(t => t.message_id === messageId);
  
  if (index === -1) return null;
  
  transcripts[index].status = status;
  await fs.writeFile(TRANSCRIPTS_FILE, JSON.stringify(transcripts, null, 2));
  
  return transcripts[index];
}

// Delete a transcript
export async function deleteTranscript(messageId: string): Promise<boolean> {
  const transcripts = await getAllTranscripts();
  const filtered = transcripts.filter(t => t.message_id !== messageId);
  
  if (filtered.length === transcripts.length) return false;
  
  await fs.writeFile(TRANSCRIPTS_FILE, JSON.stringify(filtered, null, 2));
  return true;
}

