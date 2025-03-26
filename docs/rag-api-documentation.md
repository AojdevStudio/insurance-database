# Dental Insurance RAG API Documentation

## Overview
This documentation covers the Retrieval Augmented Generation (RAG) API endpoints and integration guidelines specifically designed for dental insurance applications. The API enables efficient semantic search, content retrieval, and RAG integration capabilities for processing dental policies, coverage guidelines, and benefit documentation.

## 1. Semantic Search Endpoints

### 1.1 Full Text Search API
**Endpoint:** `POST /api/search/fulltext`

Performs semantic full-text search across dental insurance documents, policies, and benefit guidelines.

**Request Parameters:**
```json
{
  "query": "string",
  "filters": {
    "carrier": "string",
    "documentType": "string",
    "effectiveDate": "date",
    "cdtCodes": ["string"],
    "benefitCategory": "string",
    "toothNumbers": ["string"],
    "surfaces": ["string"]
  },
  "limit": number,
  "offset": number
}
```

**Example Dental Insurance Queries:**
```python
# Search for dental policy guidelines
response = requests.post('/api/search/fulltext', json={
    'query': 'coverage criteria for dental implants',
    'filters': {
        'carrier': 'Delta Dental',
        'documentType': 'dental_policy',
        'effectiveDate': '2024-01-01',
        'benefitCategory': 'major'
    }
})

# Search for procedure code policies
response = requests.post('/api/search/fulltext', json={
    'query': 'frequency limitations for prophylaxis',
    'filters': {
        'cdtCodes': ['D1110'],  # Adult prophylaxis
        'documentType': 'coverage_determination',
        'benefitCategory': 'preventive'
    }
})
```

### 1.2 Embedding-based Search API
**Endpoint:** `POST /api/search/embedding`

Performs vector similarity search optimized for dental terminology and insurance concepts.

**Request Parameters:**
```json
{
  "embedding": number[],
  "model": "string",
  "filters": {
    "carrier": "string",
    "specialty": "string",  // e.g., "Endodontics", "Periodontics"
    "policyType": "string",
    "benefitCategory": "string"  // "preventive", "basic", "major"
  },
  "similarity_threshold": number,
  "limit": number
}
```

**Example Dental Use Case:**
```python
# Search for similar dental policies across carriers
response = requests.post('/api/search/embedding', json={
    'embedding': policy_embedding,
    'filters': {
        'specialty': 'Prosthodontics',
        'policyType': 'coverage_determination',
        'benefitCategory': 'major'
    },
    'similarity_threshold': 0.85
})
```

### 1.3 Hybrid Search API
**Endpoint:** `POST /api/search/hybrid`

Combines keyword and semantic search for comprehensive dental insurance document retrieval.

**Request Parameters:**
```json
{
  "query": "string",
  "embedding": number[],
  "filters": {
    "carrier": "string",
    "network": "string",
    "region": "string",
    "planType": "string",  // "DHMO", "DPPO", etc.
    "benefitCategory": "string"
  },
  "weights": {
    "keyword": number,
    "semantic": number
  }
}
```

## 2. Content Retrieval Endpoints

### 2.1 Document Chunks API
**Endpoint:** `GET /api/content/chunks/{document_id}`

Retrieves document chunks with dental insurance optimization.

**Query Parameters:**
- `chunk_size`: number (default: 512)
- `overlap`: number (default: 50)
- `include_metadata`: boolean
- `extract_codes`: boolean (extracts CDT codes)

**Response Format:**
```json
{
  "chunks": [
    {
      "id": "string",
      "content": "string",
      "position": number,
      "metadata": {
        "carrier": "string",
        "effectiveDate": "date",
        "expirationDate": "date",
        "cdtCodes": ["string"],
        "benefitCategory": "string",
        "frequencyLimitations": {
          "period": "string",
          "limit": number,
          "ageLimits": {
            "min": number,
            "max": number
          }
        }
      },
      "extractedCodes": {
        "cdt": ["string"],
        "toothNumbers": ["string"],
        "surfaces": ["string"]
      }
    }
  ]
}
```

### 2.2 Context Window API
**Endpoint:** `GET /api/content/context/{chunk_id}`

Retrieves surrounding context for dental insurance document chunks.

**Dental-Specific Features:**
- Maintains benefit category context
- Preserves procedure code relationships
- Includes frequency limitations
- Links to related procedures
- Maintains tooth/surface designations
- Tracks alternative benefits

### 2.3 Metadata Access API
**Endpoint:** `GET /api/content/metadata`

Retrieves dental insurance-specific document metadata.

**Dental-Specific Fields:**
- Carrier information
- Network details
- Benefit categories
- Waiting periods
- Frequency limitations
- Pre-treatment estimate requirements
- Alternative benefit provisions

## 3. Integration Guide

### 3.1 Dental Insurance Examples

#### Policy Search and Retrieval
```python
# Search for crown coverage requirements
response = requests.post('/api/search/fulltext', json={
    'query': 'coverage criteria for porcelain fused to metal crown',
    'filters': {
        'carrier': 'Delta Dental',
        'documentType': 'coverage_policy',
        'cdtCodes': ['D2750'],
        'benefitCategory': 'major'
    }
})

# Check frequency limitations
response = requests.post('/api/search/fulltext', json={
    'query': 'frequency limitations for bitewing radiographs',
    'filters': {
        'cdtCodes': ['D0274'],
        'benefitCategory': 'preventive'
    }
})
```

### 3.2 Best Practices

1. **Document Chunking for Dental Content**
   - Maintain benefit category boundaries
   - Preserve procedure code context
   - Keep tooth/surface designations together
   - Group related procedures
   - Maintain frequency limitation context

2. **Dental Code Handling**
   - Use current CDT code version
   - Track code changes annually
   - Maintain alternative benefit relationships
   - Link to tooth/surface requirements
   - Track frequency limitations

3. **Policy Version Management**
   - Track benefit year updates
   - Maintain waiting period history
   - Handle plan changes
   - Archive expired policies
   - Track frequency limitation changes

4. **HIPAA Compliance**
   - PHI identification and protection
   - Audit trail maintenance
   - Access control implementation
   - Data encryption requirements

### 3.3 Performance Optimization

1. **Dental-Specific Indexing**
   - Index by benefit category
   - Optimize for frequency checks
   - Track tooth history
   - Maintain surface relationships

2. **Query Optimization**
   - Use benefit category filters
   - Leverage CDT code hierarchies
   - Cache common benefit lookups
   - Optimize for pre-treatment estimates

3. **Batch Operations**
   - Annual CDT code updates
   - Benefit year rollovers
   - Plan contract updates
   - Fee schedule updates

## Security and Compliance

### HIPAA Compliance
- PHI handling guidelines
- Minimum necessary access
- Audit logging requirements
- Data encryption standards

### Access Control
- Role-based access
- Carrier-specific permissions
- Network-level restrictions
- User authentication

## Rate Limiting and Usage

- Standard: 100 requests/minute
- Bulk operations: 10 requests/minute
- Policy updates: 5 requests/minute
- Real-time benefit checks: 200 requests/minute

## Error Handling

Dental insurance-specific error codes:
- 4001: Invalid CDT code
- 4002: Expired policy
- 4003: Invalid carrier
- 4004: Invalid tooth number
- 4005: Invalid surface
- 4006: Frequency limitation exceeded
- 4007: Waiting period not satisfied
- 4008: Missing pre-treatment estimate

## Support and Resources

- Documentation: [link]
- API Status: [link]
- CDT Code Updates: [link]
- Compliance Guidelines: [link] 