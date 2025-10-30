-- Add user_id column to transcripts table for multi-tenant support
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_transcripts_user_id ON transcripts(user_id);

-- Update RLS policy to filter by user_id
DROP POLICY IF EXISTS "Allow all operations on transcripts" ON transcripts;

-- Create policy to allow users to see only their own transcripts
CREATE POLICY "Users can view their own transcripts" ON transcripts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transcripts" ON transcripts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transcripts" ON transcripts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transcripts" ON transcripts
  FOR DELETE
  USING (auth.uid() = user_id);

