-- Create json_uploads table
CREATE TABLE IF NOT EXISTS public.json_uploads (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    file_name TEXT NOT NULL,
    content JSONB NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comment to describe the table
COMMENT ON TABLE public.json_uploads IS 'Stores uploaded JSON files with their content and metadata';

-- Create index on file_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_json_uploads_file_name ON public.json_uploads(file_name);

-- Enable RLS
ALTER TABLE public.json_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.json_uploads
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.json_uploads
    FOR INSERT
    TO authenticated
    WITH CHECK (true); 