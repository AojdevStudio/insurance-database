# Data Transfer API

This document describes the data import and export functionality implemented in the Insurance Database API.

## Overview

The Data Transfer API provides efficient batch processing for importing and exporting data. It supports:

- Batch importing of data with transaction support
- Data validation before import
- Updating existing records
- Exporting data with filtering and relation inclusion
- Multiple export formats (JSON and CSV)

## API Endpoints

### Import Data

```
POST /api/data-transfer/import
```

Imports data in batches with transaction support.

#### Request Body

```json
{
  "data": [
    {
      "carrierName": "Delta Dental",
      "carrierCode": "DELTA"
    },
    {
      "carrierName": "Cigna Dental",
      "carrierCode": "CIGNA"
    }
  ],
  "options": {
    "entityType": "carrier",
    "batchSize": 100,
    "validateOnly": false,
    "updateExisting": false
  }
}
```

#### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| data | array | Yes | - | Array of data objects to import |
| options | object | Yes | - | Import options |
| options.entityType | string | Yes | - | Type of entity to import ('carrier', 'procedure', 'guideline', 'network', 'plan') |
| options.batchSize | number | No | 100 | Number of records to process in each batch |
| options.validateOnly | boolean | No | false | Whether to only validate the data without importing |
| options.updateExisting | boolean | No | false | Whether to update existing records |

#### Response

```json
{
  "success": true,
  "totalRecords": 2,
  "processedRecords": 2,
  "createdRecords": 2,
  "updatedRecords": 0,
  "failedRecords": 0,
  "errors": []
}
```

### Export Data

```
GET /api/data-transfer/export
```

Exports data with filtering and relation inclusion.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| entityType | string | Yes | - | Type of entity to export ('carrier', 'procedure', 'guideline', 'network', 'plan') |
| format | string | No | 'json' | Export format ('json' or 'csv') |
| filters | string | No | - | JSON string of filters to apply |
| includeRelations | boolean | No | false | Whether to include related entities |
| limit | number | No | - | Maximum number of records to export |
| offset | number | No | 0 | Number of records to skip |

#### Response (JSON format)

```json
{
  "success": true,
  "totalRecords": 2,
  "data": [
    {
      "id": 1,
      "carrierName": "Delta Dental",
      "carrierCode": "DELTA"
    },
    {
      "id": 2,
      "carrierName": "Cigna Dental",
      "carrierCode": "CIGNA"
    }
  ],
  "format": "json",
  "entityType": "carrier",
  "timestamp": "2025-04-05T12:00:00.000Z"
}
```

#### Response (CSV format)

The response will be a CSV file with the appropriate headers:

```
id,carrierName,carrierCode
1,Delta Dental,DELTA
2,Cigna Dental,CIGNA
```

### Validate Import Data

```
POST /api/data-transfer/validate
```

Validates import data without actually importing it.

#### Request Body

```json
{
  "data": [
    {
      "carrierName": "Delta Dental",
      "carrierCode": "DELTA"
    }
  ],
  "entityType": "carrier"
}
```

#### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| data | array | Yes | - | Array of data objects to validate |
| entityType | string | Yes | - | Type of entity to validate ('carrier', 'procedure', 'guideline', 'network', 'plan') |

#### Response

```json
{
  "success": true,
  "totalRecords": 1,
  "validationErrors": []
}
```

## Implementation Details

### Batch Processing

The import functionality processes data in batches to optimize performance and memory usage:

1. Data is first validated to ensure all required fields are present
2. If validation passes, data is processed in batches of a configurable size
3. Each batch is processed in a transaction to ensure atomicity
4. If a batch fails, the error is recorded and processing continues with the next batch

### Transaction Support

Each batch is processed in a transaction, which provides several benefits:

- Atomicity: Either all records in a batch are processed or none are
- Consistency: The database remains in a consistent state
- Isolation: Concurrent imports don't interfere with each other
- Durability: Once a batch is committed, the changes are permanent

### Data Validation

Data validation is performed before import to ensure data integrity:

- Required fields are checked for each entity type
- Validation errors are returned with the index and field name
- If validation fails, no data is imported

### Prisma Integration

The data transfer functionality is implemented using Prisma's transaction support and query capabilities:

- `prisma.$transaction` for atomic batch processing
- Prisma's query API for efficient data retrieval and manipulation
- Type-safe database operations

## Example Usage

### Importing Carriers

```javascript
// Example request
const response = await fetch('/api/data-transfer/import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    data: [
      { carrierName: 'Delta Dental', carrierCode: 'DELTA' },
      { carrierName: 'Cigna Dental', carrierCode: 'CIGNA' }
    ],
    options: {
      entityType: 'carrier',
      updateExisting: true
    }
  })
});

const result = await response.json();
console.log(`Imported ${result.createdRecords} new carriers and updated ${result.updatedRecords} existing carriers`);
```

### Exporting Procedures with Filtering

```javascript
// Example request
const response = await fetch('/api/data-transfer/export?entityType=procedure&format=json&filters={"category":"Diagnostic"}&includeRelations=true');

const result = await response.json();
console.log(`Exported ${result.totalRecords} procedures in the Diagnostic category`);
```

## Error Handling

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Invalid request (missing or invalid parameters) |
| 500 | Server error during import or export |

## Performance Considerations

- Use appropriate batch sizes for import (default: 100)
- For large exports, use pagination (limit and offset parameters)
- Include relations only when needed, as it increases query complexity
- Use filters to limit the amount of data exported
