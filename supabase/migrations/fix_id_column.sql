-- Migration to change id column from UUID to TEXT
-- This is needed because AssemblyAI generates transcript IDs like "transcript_1761632266357"
-- which are not valid UUIDs

-- Step 1: Drop the existing table if it has UUID id column
-- (This is safe for development, but in production you'd want to migrate data)
DROP TABLE IF EXISTS transcripts CASCADE;

-- Step 2: Recreate the table with TEXT id
CREATE TABLE transcripts (
  id TEXT PRIMARY KEY,  -- Changed from UUID to TEXT to support AssemblyAI transcript IDs
  contact_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  duration_seconds INTEGER DEFAULT 0,
  sentiment TEXT DEFAULT 'NEUTRAL',
  sentiment_score INTEGER DEFAULT 50,
  summary TEXT DEFAULT 'Transcription in progress...',
  action_items JSONB DEFAULT '[]'::jsonb,
  full_text TEXT DEFAULT '',
  speakers JSONB DEFAULT '[]'::jsonb,
  audio_url TEXT,
  status TEXT DEFAULT 'processing',
  
  -- Indexes for faster queries
  CONSTRAINT transcripts_message_id_key UNIQUE (message_id)
);

-- Create index on contact_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_transcripts_contact_id ON transcripts(contact_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON transcripts(created_at DESC);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_transcripts_status ON transcripts(status);

-- Enable Row Level Security (RLS)
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (you can restrict this later)
CREATE POLICY "Allow all operations on transcripts" ON transcripts
  FOR ALL
  USING (true)
  WITH CHECK (true);

