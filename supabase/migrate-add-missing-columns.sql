-- Migration: Add missing columns to transcripts table
-- Run this in Supabase SQL Editor if columns are missing

-- Add duration_seconds if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transcripts' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE transcripts ADD COLUMN duration_seconds INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add sentiment if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transcripts' AND column_name = 'sentiment'
  ) THEN
    ALTER TABLE transcripts ADD COLUMN sentiment TEXT DEFAULT 'NEUTRAL';
  END IF;
END $$;

-- Add sentiment_score if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transcripts' AND column_name = 'sentiment_score'
  ) THEN
    ALTER TABLE transcripts ADD COLUMN sentiment_score INTEGER DEFAULT 50;
  END IF;
END $$;

-- Add summary if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transcripts' AND column_name = 'summary'
  ) THEN
    ALTER TABLE transcripts ADD COLUMN summary TEXT DEFAULT 'Transcription in progress...';
  END IF;
END $$;

-- Add action_items if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transcripts' AND column_name = 'action_items'
  ) THEN
    ALTER TABLE transcripts ADD COLUMN action_items JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add full_text if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transcripts' AND column_name = 'full_text'
  ) THEN
    ALTER TABLE transcripts ADD COLUMN full_text TEXT DEFAULT '';
  END IF;
END $$;

-- Add speakers if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transcripts' AND column_name = 'speakers'
  ) THEN
    ALTER TABLE transcripts ADD COLUMN speakers JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add audio_url if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transcripts' AND column_name = 'audio_url'
  ) THEN
    ALTER TABLE transcripts ADD COLUMN audio_url TEXT;
  END IF;
END $$;

-- Add status if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transcripts' AND column_name = 'status'
  ) THEN
    ALTER TABLE transcripts ADD COLUMN status TEXT DEFAULT 'processing';
  END IF;
END $$;

-- Verify all columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'transcripts' 
ORDER BY ordinal_position;

