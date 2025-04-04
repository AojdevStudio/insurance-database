-- Performance optimization indexes for Phase 7 of Prisma ORM implementation

-- Create extensions for full-text search and vector operations if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- Add indexes for insurance_carriers table
CREATE INDEX IF NOT EXISTS idx_carrier_name ON insurance_carriers(carrier_name);
CREATE INDEX IF NOT EXISTS idx_carrier_payer_id ON insurance_carriers(payer_id);

-- Add indexes for procedures table
CREATE INDEX IF NOT EXISTS idx_procedure_code ON procedures(procedure_code);
CREATE INDEX IF NOT EXISTS idx_procedure_category ON procedures(category);

-- Add indexes for document_pages table
CREATE INDEX IF NOT EXISTS idx_page_document_id ON document_pages(document_id);
CREATE INDEX IF NOT EXISTS idx_page_content_gin ON document_pages USING gin(to_tsvector('english', content));

-- Add indexes for document_procedures table
CREATE INDEX IF NOT EXISTS idx_doc_proc_document_id ON document_procedures(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_proc_procedure_code ON document_procedures(procedure_code);

-- Add indexes for carrier_procedure_requirements table
CREATE INDEX IF NOT EXISTS idx_req_carrier_id ON carrier_procedure_requirements(carrier_id);
CREATE INDEX IF NOT EXISTS idx_req_procedure_id ON carrier_procedure_requirements(procedure_id);

-- Add indexes for guidelines table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'guidelines') THEN
        -- Add trigram index for content similarity search
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_guideline_content_trgm ON guidelines USING gin(content gin_trgm_ops)';
        
        -- Add trigram index for title similarity search
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_guideline_title_trgm ON guidelines USING gin(title gin_trgm_ops)';
        
        -- Add B-tree index for carrier_id
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_guideline_carrier_id ON guidelines(carrier_id)';
        
        -- Add B-tree index for category
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_guideline_category ON guidelines(category)';
        
        -- Check if embedding column exists and create vector index if it does
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'guidelines' AND column_name = 'embedding') THEN
            -- Create vector index for embedding column
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_guideline_embedding ON guidelines USING ivfflat (embedding vector_l2_ops)';
        END IF;
    END IF;
END
$$;

-- Add query-specific index for semantic search performance
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'guidelines') 
    AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'guidelines' AND column_name = 'embedding') THEN
        -- Create specialized vector index for semantic search with appropriate configuration
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_guideline_embedding_cosine ON guidelines USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
    END IF;
END
$$;

-- Add additional advanced indexes for hybrid search optimal performance
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'guidelines') THEN
        -- Create composite index for carrier filtering + text search
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_guideline_carrier_content ON guidelines(carrier_id, content)';
        
        -- Create functional index for case-insensitive search
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_guideline_content_lower ON guidelines(lower(content))';
    END IF;
END
$$;

-- Add indexes for carrier_documents table
CREATE INDEX IF NOT EXISTS idx_document_carrier_id ON carrier_documents(carrier_id);
CREATE INDEX IF NOT EXISTS idx_document_filename ON carrier_documents(filename);

-- Add indexes for network_carrier_relationships table
CREATE INDEX IF NOT EXISTS idx_network_rel_network_id ON network_carrier_relationships(network_id);
CREATE INDEX IF NOT EXISTS idx_network_rel_carrier_id ON network_carrier_relationships(carrier_id);

-- Create specialized search functions to optimize complex queries
CREATE OR REPLACE FUNCTION get_similar_guidelines(
    search_query TEXT,
    carrier_id_param BIGINT DEFAULT NULL,
    category_param TEXT DEFAULT NULL,
    min_similarity FLOAT DEFAULT 0.3,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id BIGINT,
    title TEXT,
    content TEXT,
    carrier_id BIGINT,
    category TEXT,
    created_at TIMESTAMPTZ,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.title,
        g.content,
        g.carrier_id,
        g.category,
        g.created_at,
        similarity(g.content, search_query) AS similarity
    FROM guidelines g
    WHERE 
        similarity(g.content, search_query) > min_similarity
        AND (carrier_id_param IS NULL OR g.carrier_id = carrier_id_param)
        AND (category_param IS NULL OR g.category = category_param)
    ORDER BY similarity DESC
    LIMIT result_limit;
END;
$$;

-- Add comments to explain optimization purpose
COMMENT ON INDEX idx_carrier_name IS 'Optimizes carrier lookup by name for search operations';
COMMENT ON INDEX idx_procedure_code IS 'Optimizes procedure lookup by code for requirements matching';
COMMENT ON INDEX idx_guideline_content_trgm IS 'Optimizes text similarity search on guideline content';
COMMENT ON INDEX idx_guideline_embedding IS 'Optimizes vector similarity search for semantic queries';
COMMENT ON FUNCTION get_similar_guidelines IS 'Optimized function for text similarity search with filtering';
