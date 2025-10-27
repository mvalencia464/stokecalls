-- Create transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

