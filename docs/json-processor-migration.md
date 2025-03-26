# JSON Processor Migration to TypeScript

This document explains the migration of the `process-json-data.js` file to a modular TypeScript structure.

## Overview

The original JavaScript file has been refactored into a well-structured TypeScript implementation with the following components:

### Directory Structure

```
src/
├── types/
│   └── document.ts           # Type definitions for documents and procedures
├── processors/
│   ├── database.ts           # Database operations
│   ├── extraction.ts         # Procedure extraction logic
│   ├── json-processor.ts     # Main processor class
│   ├── state.ts              # State management 
│   └── validator.ts          # JSON schema validation
└── scripts/
    └── process-json.ts       # CLI entry point
```

## Key Improvements

1. **Type Safety**: Full TypeScript typing for better code reliability and IDE support
2. **Modular Architecture**: Separation of concerns into focused classes
3. **Enhanced Error Handling**: Consistent error handling with detailed logging
4. **Cleaner API**: Class-based approach for better organization
5. **Maintainability**: Easier to test and extend

## Migration Changes

### 1. Type Definitions

Created interfaces for all data structures in `src/types/document.ts`:
- `ProcessingState`
- `Carrier`
- `Document` and `DocumentPage`
- `Procedure` and `DatabaseProcedure`
- `CarrierData`

### 2. Procedure Extraction

Moved the procedure extraction logic to a dedicated `ExtractionService` class:
- Encapsulated the regex patterns as class constants
- Added proper type safety
- Improved error handling

### 3. State Management

Converted state management to a class-based approach:
- Added methods for checking if a file has been processed
- Improved error handling with logging

### 4. Database Operations

Consolidated database operations into a single class:
- Added proper connection management
- Enhanced error handling with detailed logging
- Improved transaction management

### 5. Validation

Created a dedicated schema validator class:
- Properly typed JSON schema
- Detailed error reporting
- Lazy initialization of the validator

## Usage

### Running the Processor

```bash
# Process all JSON files
npm run process-json

# Process a specific file
npm run process-json -- --file example.json

# Process files in a different directory
npm run process-json -- --dir ./custom-directory
```

### Production Use

```bash
# Build the TypeScript code
npm run build

# Run the built processor
npm run process-json:build
```

## Testing

To add tests for the processor, create test files in the `tests/processors` directory:

```
tests/
└── processors/
    ├── extraction.test.ts
    ├── json-processor.test.ts
    └── validator.test.ts
```

Run tests with:

```bash
npm test
```
