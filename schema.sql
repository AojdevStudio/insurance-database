-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create insurance carriers table
CREATE TABLE IF NOT EXISTS insurance_carriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create carrier documents table
CREATE TABLE IF NOT EXISTS carrier_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_id UUID REFERENCES insurance_carriers(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    total_pages INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(carrier_id, filename)
);

-- Create document pages table
CREATE TABLE IF NOT EXISTS document_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES carrier_documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, page_number)
);

-- Create document procedures table
CREATE TABLE IF NOT EXISTS document_procedures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES carrier_documents(id) ON DELETE CASCADE,
    procedure_code TEXT NOT NULL,
    description TEXT,
    submission_requirements TEXT,
    documentation_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, procedure_code)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_carrier_documents_carrier_id ON carrier_documents(carrier_id);
CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON document_pages(document_id);
CREATE INDEX IF NOT EXISTS idx_document_procedures_document_id ON document_procedures(document_id);
CREATE INDEX IF NOT EXISTS idx_document_procedures_procedure_code ON document_procedures(procedure_code); 