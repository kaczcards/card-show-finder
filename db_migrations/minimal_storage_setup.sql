-- Minimal Storage Setup for Card Images
-- Simple setup for card image storage bucket with basic security policies

-- Create the storage bucket for card images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('card_images', 'Card Images', true)
ON CONFLICT (id) DO NOTHING;

-- Make sure the bucket is public for reading
UPDATE storage.buckets
SET public = true
WHERE id = 'card_images';

-- Basic policy to allow authenticated users to upload their own images
CREATE POLICY "Users can upload their own card images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'card_images'
);

-- Basic policy to allow users to update their own images
CREATE POLICY "Users can update their own card images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'card_images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Basic policy to allow users to delete their own images
CREATE POLICY "Users can delete their own card images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'card_images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to all card images
CREATE POLICY "Public read access for card images"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'card_images'
);
