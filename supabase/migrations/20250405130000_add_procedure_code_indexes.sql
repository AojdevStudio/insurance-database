-- Add indexes for procedure code search
-- This migration adds indexes for optimizing procedure code search

-- Create index for procedure code
CREATE INDEX IF NOT EXISTS idx_procedure_code ON procedure (procedure_code);

-- Create index for procedure category
CREATE INDEX IF NOT EXISTS idx_procedure_category ON procedure (category);

-- Create trigram index for procedure code fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_procedure_code_trgm ON procedure USING GIN (procedure_code gin_trgm_ops);

-- Create function for procedure code search with requirements
CREATE OR REPLACE FUNCTION procedure_code_search(
  code_pattern TEXT,
  search_type TEXT DEFAULT 'contains',
  min_score FLOAT DEFAULT 0.3,
  max_results INT DEFAULT 10,
  offset_value INT DEFAULT 0,
  filter_category TEXT DEFAULT NULL
) 
RETURNS TABLE (
  id BIGINT,
  procedure_code TEXT,
  description TEXT,
  category TEXT,
  score FLOAT
) AS $$
DECLARE
  where_clause TEXT;
  order_by_clause TEXT;
  select_score_expr TEXT;
BEGIN
  -- Set the appropriate clauses based on search type
  CASE search_type
    WHEN 'exact' THEN
      where_clause := 'p.procedure_code = ' || quote_literal(code_pattern);
      order_by_clause := 'p.procedure_code ASC';
      select_score_expr := '1.0 AS score';
    WHEN 'prefix' THEN
      where_clause := 'p.procedure_code LIKE ' || quote_literal(code_pattern || '%');
      order_by_clause := 'p.procedure_code ASC';
      select_score_expr := '0.9 AS score';
    WHEN 'suffix' THEN
      where_clause := 'p.procedure_code LIKE ' || quote_literal('%' || code_pattern);
      order_by_clause := 'p.procedure_code ASC';
      select_score_expr := '0.8 AS score';
    WHEN 'contains' THEN
      where_clause := 'p.procedure_code LIKE ' || quote_literal('%' || code_pattern || '%');
      order_by_clause := 'p.procedure_code ASC';
      select_score_expr := '0.7 AS score';
    WHEN 'fuzzy' THEN
      where_clause := 'similarity(p.procedure_code, ' || quote_literal(code_pattern) || ') > ' || min_score::TEXT;
      order_by_clause := 'score DESC';
      select_score_expr := 'similarity(p.procedure_code, ' || quote_literal(code_pattern) || ') AS score';
    ELSE
      -- Default to contains
      where_clause := 'p.procedure_code LIKE ' || quote_literal('%' || code_pattern || '%');
      order_by_clause := 'p.procedure_code ASC';
      select_score_expr := '0.7 AS score';
  END CASE;
  
  -- Add category filter if provided
  IF filter_category IS NOT NULL THEN
    where_clause := where_clause || ' AND p.category = ' || quote_literal(filter_category);
  END IF;
  
  -- Execute the dynamic query
  RETURN QUERY EXECUTE 
    'SELECT 
      p.id, 
      p.procedure_code, 
      p.description,
      p.category,
      ' || select_score_expr || '
    FROM 
      procedure p
    WHERE 
      ' || where_clause || '
    ORDER BY 
      ' || order_by_clause || '
    LIMIT ' || max_results || '
    OFFSET ' || offset_value;
END;
$$ LANGUAGE plpgsql;
