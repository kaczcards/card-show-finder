-- Storage Setup for Card Images
-- This script creates a storage bucket for card images with appropriate security policies

-- Create the storage bucket for card images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('card_images', 'card_images', true)
ON CONFLICT (id) DO NOTHING;

-- Make the bucket public for reading (anyone can view images)
UPDATE storage.buckets
SET public = true
WHERE id = 'card_images';

-- Create a policy to allow authenticated users to upload images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE  polname = 'Users can upload their own card images'
      AND  schemaname = 'storage'
  ) THEN
    CREATE POLICY "Users can upload their own card images"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'card_images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- Create a policy to allow users to update their own images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE  polname = 'Users can update their own card images'
      AND  schemaname = 'storage'
  ) THEN
    CREATE POLICY "Users can update their own card images"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'card_images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- Create a policy to allow users to delete their own images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE  polname = 'Users can delete their own card images'
      AND  schemaname = 'storage'
  ) THEN
    CREATE POLICY "Users can delete their own card images"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'card_images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- Create a policy to allow public read access to all card images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE  polname = 'Public read access for card images'
      AND  schemaname = 'storage'
  ) THEN
    CREATE POLICY "Public read access for card images"
      ON storage.objects
      FOR SELECT
      TO public
      USING (
        bucket_id = 'card_images'
      );
  END IF;
END $$;

-- Create a folder structure function to ensure images are stored in user-specific folders
CREATE OR REPLACE FUNCTION storage.user_folder_path(file_path text)
RETURNS text AS $$
DECLARE
  user_id text;
  file_name text;
BEGIN
  user_id := auth.uid()::text;
  file_name := substring(file_path from '[^/]*$');
  RETURN user_id || '/' || file_name;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to enforce user folder structure
CREATE OR REPLACE FUNCTION storage.enforce_user_folder_structure()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bucket_id = 'card_images' THEN
    NEW.name := storage.user_folder_path(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to enforce folder structure
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE  tgname = 'enforce_user_folder_structure_trigger'
  ) THEN
    CREATE TRIGGER enforce_user_folder_structure_trigger
      BEFORE INSERT ON storage.objects
      FOR EACH ROW
      WHEN (NEW.bucket_id = 'card_images')
      EXECUTE FUNCTION storage.enforce_user_folder_structure();
  END IF;
END $$;
