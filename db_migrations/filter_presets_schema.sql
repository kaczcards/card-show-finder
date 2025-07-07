-- db_migrations/filter_presets_schema.sql
-- Migration to create filter_presets table and set up RLS policies

-- Create filter_presets table
CREATE TABLE IF NOT EXISTS filter_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS filter_presets_user_id_idx ON filter_presets(user_id);

-- Create index on is_default to quickly find default presets
CREATE INDEX IF NOT EXISTS filter_presets_is_default_idx ON filter_presets(is_default);

-- Add a constraint to ensure only one default preset per user
ALTER TABLE filter_presets
    DROP CONSTRAINT IF EXISTS unique_default_preset_per_user;
    
ALTER TABLE filter_presets
    ADD CONSTRAINT unique_default_preset_per_user 
    UNIQUE (user_id, is_default) 
    DEFERRABLE INITIALLY DEFERRED;

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_filter_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_filter_presets_updated_at_trigger ON filter_presets;

CREATE TRIGGER update_filter_presets_updated_at_trigger
BEFORE UPDATE ON filter_presets
FOR EACH ROW
EXECUTE FUNCTION update_filter_presets_updated_at();

-- Enable Row Level Security
ALTER TABLE filter_presets ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow users to select only their own presets
CREATE POLICY select_own_presets ON filter_presets
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to insert only their own presets
CREATE POLICY insert_own_presets ON filter_presets
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update only their own presets
CREATE POLICY update_own_presets ON filter_presets
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Allow users to delete only their own presets
CREATE POLICY delete_own_presets ON filter_presets
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to handle setting default preset
-- This function ensures only one preset per user is set as default
CREATE OR REPLACE FUNCTION set_default_filter_preset()
RETURNS TRIGGER AS $$
BEGIN
    -- If the new/updated preset is being set as default
    IF NEW.is_default = true THEN
        -- Set all other presets for this user to not default
        UPDATE filter_presets
        SET is_default = false
        WHERE user_id = NEW.user_id
          AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_default_filter_preset_trigger ON filter_presets;

CREATE TRIGGER set_default_filter_preset_trigger
BEFORE INSERT OR UPDATE OF is_default ON filter_presets
FOR EACH ROW
WHEN (NEW.is_default = true)
EXECUTE FUNCTION set_default_filter_preset();

-- Add comment to table
COMMENT ON TABLE filter_presets IS 'Stores user-specific filter presets for the Card Show Finder app';
