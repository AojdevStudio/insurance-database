-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create carrier_documents table
CREATE TABLE carrier_documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    carrier_id BIGINT REFERENCES insurance_carriers(id),
    filename TEXT NOT NULL,
    metadata JSONB,
    total_pages INTEGER NOT NULL,
    processed_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create document_pages table
CREATE TABLE document_pages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id BIGINT REFERENCES carrier_documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, page_number)
);

-- Create document_procedures table
CREATE TABLE document_procedures (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id BIGINT REFERENCES carrier_documents(id) ON DELETE CASCADE,
    procedure_code TEXT NOT NULL,
    description TEXT,
    submission_requirements TEXT,
    documentation_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, procedure_code)
);

-- Add indexes for better query performance
CREATE INDEX idx_carrier_documents_carrier_id ON carrier_documents(carrier_id);
CREATE INDEX idx_carrier_documents_filename ON carrier_documents(filename);
CREATE INDEX idx_document_pages_document_id ON document_pages(document_id);
CREATE INDEX idx_document_procedures_document_id ON document_procedures(document_id);
CREATE INDEX idx_document_procedures_procedure_code ON document_procedures(procedure_code);

-- Add updated_at triggers
CREATE TRIGGER set_timestamp_carrier_documents
    BEFORE UPDATE ON carrier_documents
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_document_pages
    BEFORE UPDATE ON document_pages
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_document_procedures
    BEFORE UPDATE ON document_procedures
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Add RLS policies
ALTER TABLE carrier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_procedures ENABLE ROW LEVEL SECURITY;

-- Read access policies
CREATE POLICY "Enable read access for authenticated users" ON carrier_documents
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Enable read access for authenticated users" ON document_pages
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Enable read access for authenticated users" ON document_procedures
    FOR SELECT TO authenticated
    USING (true);

-- Insert access policies
CREATE POLICY "Enable insert access for authenticated users" ON carrier_documents
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable insert access for authenticated users" ON document_pages
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable insert access for authenticated users" ON document_procedures
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Update access policies
CREATE POLICY "Enable update access for authenticated users" ON carrier_documents
    FOR UPDATE TO authenticated
    USING (true);

CREATE POLICY "Enable update access for authenticated users" ON document_pages
    FOR UPDATE TO authenticated
    USING (true);

CREATE POLICY "Enable update access for authenticated users" ON document_procedures
    FOR UPDATE TO authenticated
    USING (true);

-- Function to upsert a carrier document
CREATE OR REPLACE FUNCTION public.upsert_carrier_document(
    p_carrier_id BIGINT,
    p_filename TEXT,
    p_metadata JSONB,
    p_total_pages INTEGER
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_document_id BIGINT;
BEGIN
    -- Insert or update the document
    INSERT INTO public.carrier_documents (
        carrier_id,
        filename,
        metadata,
        total_pages,
        processed_date
    )
    VALUES (
        p_carrier_id,
        p_filename,
        p_metadata,
        p_total_pages,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (carrier_id, filename) DO UPDATE
    SET
        metadata = EXCLUDED.metadata,
        total_pages = EXCLUDED.total_pages,
        processed_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_document_id;

    RETURN v_document_id;
END;
$$;

-- Function to insert a document page
CREATE OR REPLACE FUNCTION public.insert_document_page(
    p_document_id BIGINT,
    p_page_number INTEGER,
    p_content TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_page_id BIGINT;
BEGIN
    INSERT INTO public.document_pages (
        document_id,
        page_number,
        content
    )
    VALUES (
        p_document_id,
        p_page_number,
        p_content
    )
    ON CONFLICT (document_id, page_number) DO UPDATE
    SET
        content = EXCLUDED.content,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_page_id;

    RETURN v_page_id;
END;
$$;

-- Function to insert a document procedure
CREATE OR REPLACE FUNCTION public.insert_document_procedure(
    p_document_id BIGINT,
    p_procedure_code TEXT,
    p_description TEXT,
    p_submission_requirements TEXT,
    p_documentation_required BOOLEAN
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_procedure_id BIGINT;
BEGIN
    INSERT INTO public.document_procedures (
        document_id,
        procedure_code,
        description,
        submission_requirements,
        documentation_required
    )
    VALUES (
        p_document_id,
        p_procedure_code,
        p_description,
        p_submission_requirements,
        p_documentation_required
    )
    ON CONFLICT (document_id, procedure_code) DO UPDATE
    SET
        description = EXCLUDED.description,
        submission_requirements = EXCLUDED.submission_requirements,
        documentation_required = EXCLUDED.documentation_required,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_procedure_id;

    RETURN v_procedure_id;
END;
$$;

-- Add unique constraint for carrier_id + filename
ALTER TABLE public.carrier_documents
ADD CONSTRAINT unique_carrier_document UNIQUE (carrier_id, filename); 