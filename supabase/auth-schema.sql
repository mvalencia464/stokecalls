-- Authentication Schema Updates for StokeCalls
-- Run this in your Supabase SQL Editor after setting up the basic schema

-- First, drop the old permissive policy
DROP POLICY IF EXISTS "Allow all operations on transcripts" ON transcripts;

-- Create new RLS policies that require authentication

-- Policy: Authenticated users can read all transcripts
CREATE POLICY "Authenticated users can read transcripts" ON transcripts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can insert transcripts
CREATE POLICY "Authenticated users can insert transcripts" ON transcripts
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can update transcripts
CREATE POLICY "Authenticated users can update transcripts" ON transcripts
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can delete transcripts
CREATE POLICY "Authenticated users can delete transcripts" ON transcripts
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Verify RLS is enabled (should already be enabled from schema.sql)
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

