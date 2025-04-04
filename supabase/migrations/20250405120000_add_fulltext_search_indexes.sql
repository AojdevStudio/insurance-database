-- Add full-text search indexes for guidelines table
-- This migration adds GIN indexes for full-text search on the guidelines table

-- Create GIN index for full-text search on title and content
CREATE INDEX IF NOT EXISTS idx_guidelines_fulltext ON guidelines 
USING GIN (to_tsvector('english', title || ' ' || content));

-- Create function for full-text search with highlights
CREATE OR REPLACE FUNCTION fulltext_search(
  query_text TEXT,
  similarity_threshold FLOAT DEFAULT 0.01,
  max_results INT DEFAULT 10,
  offset_value INT DEFAULT 0,
  filter_carrier_id BIGINT DEFAULT NULL,
  filter_category TEXT DEFAULT NULL
) 
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  content TEXT,
  category TEXT,
  carrier_id BIGINT,
  carrier_name TEXT,
  rank FLOAT,
  title_highlights TEXT,
  content_highlights TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.title,
    g.content,
    g.category,
    g.carrier_id,
    c.carrier_name,
    ts_rank(to_tsvector('english', g.title || ' ' || g.content), to_tsquery('english', query_text)) AS rank,
    ts_headline('english', g.title, to_tsquery('english', query_text), 'MaxFragments=1, MinWords=1, MaxWords=10') AS title_highlights,
    ts_headline('english', g.content, to_tsquery('english', query_text), 'MaxFragments=3, MinWords=5, MaxWords=20, FragmentDelimiter="..."') AS content_highlights
  FROM 
    guidelines g
  JOIN 
    insurance_carriers c ON g.carrier_id = c.id
  WHERE 
    to_tsvector('english', g.title || ' ' || g.content) @@ to_tsquery('english', query_text)
    AND ts_rank(to_tsvector('english', g.title || ' ' || g.content), to_tsquery('english', query_text)) > similarity_threshold
    AND (filter_carrier_id IS NULL OR g.carrier_id = filter_carrier_id)
    AND (filter_category IS NULL OR g.category = filter_category)
  ORDER BY 
    rank DESC
  LIMIT 
    max_results
  OFFSET 
    offset_value;
END;
$$ LANGUAGE plpgsql;
