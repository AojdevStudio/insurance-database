# Comprehensive Plan for Insurance Database Implementation

Based on the information from your dental-narrator-beta project and the DNOA documentation, I'll outline a structured approach to building a robust relational database for your insurance information.

## Day 1: Database Design and Schema Creation

### Phase 1: Analysis of Current Data (2 hours)
- **Review your CSV data**: 475 rows of insurance carriers with fields for company name, payer ID, similar names, claims address, and phone number
- **Analyze the JSON files** in your @Parsed directory: DNOA, Delta Dental, BCBS, etc.
- **Document the relationships** evident in the DNOA files showing network-carrier hierarchies
- **Identify key data points** needed for the agent to provide accurate advice

### Phase 2: Schema Design (3 hours)

#### Core Tables Structure

1. **insurance_networks**
   ```sql
   CREATE TABLE insurance_networks (
     id SERIAL PRIMARY KEY,
     name VARCHAR(255) NOT NULL UNIQUE,
     code VARCHAR(50),
     description TEXT,
     website VARCHAR(255),
     contact_info JSONB,
     guidelines JSONB,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **insurance_carriers**
   ```sql
   CREATE TABLE insurance_carriers (
     id SERIAL PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     payer_id VARCHAR(50),
     similar_names JSONB, -- Array of alternative names
     claims_address TEXT,
     phone_number VARCHAR(20),
     network_id INTEGER REFERENCES insurance_networks(id),
     website VARCHAR(255),
     code VARCHAR(50),
     contact_info JSONB,
     guidelines JSONB,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. **insurance_plans**
   ```sql
   CREATE TABLE insurance_plans (
     id SERIAL PRIMARY KEY,
     carrier_id INTEGER REFERENCES insurance_carriers(id),
     name VARCHAR(255) NOT NULL,
     plan_type VARCHAR(50), -- PPO, HMO, etc.
     state VARCHAR(2), -- For state-specific plans
     coverage_details JSONB,
     specific_guidelines JSONB,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

4. **procedures**
   ```sql
   CREATE TABLE procedures (
     id SERIAL PRIMARY KEY,
     code VARCHAR(20) NOT NULL,
     description TEXT NOT NULL,
     category VARCHAR(100),
     subcategory VARCHAR(100),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

5. **carrier_procedure_requirements**
   ```sql
   CREATE TABLE carrier_procedure_requirements (
     id SERIAL PRIMARY KEY,
     carrier_id INTEGER REFERENCES insurance_carriers(id),
     procedure_id INTEGER REFERENCES procedures(id),
     requirements JSONB,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

6. **documentation_requirements**
   ```sql
   CREATE TABLE documentation_requirements (
     id SERIAL PRIMARY KEY,
     carrier_id INTEGER REFERENCES insurance_carriers(id),
     procedure_id INTEGER REFERENCES procedures(id),
     requirements JSONB,
     examples JSONB,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

7. **guidelines**
   ```sql
   CREATE TABLE guidelines (
     id SERIAL PRIMARY KEY,
     carrier_id INTEGER REFERENCES insurance_carriers(id),
     title VARCHAR(255) NOT NULL,
     content TEXT NOT NULL,
     category VARCHAR(100),
     content_embedding VECTOR(1536),
     metadata JSONB,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

8. **appeal_procedures**
   ```sql
   CREATE TABLE appeal_procedures (
     id SERIAL PRIMARY KEY,
     carrier_id INTEGER REFERENCES insurance_carriers(id),
     appeal_process JSONB,
     timelines JSONB,
     templates JSONB,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

### Phase 3: Schema Implementation (2 hours)

1. **Create Schema Migration File**
   - Develop SQL migration script with all table definitions
   - Include indexes for frequently queried fields
   - Set up foreign key constraints
   - Add vector search capabilities for guidelines

2. **Implement Full-Text Search**
   - Set up search configuration for insurance carriers
   - Configure similar_names search functionality
   - Implement fuzzy matching for carrier lookup

## Day 2: Data Import and Validation

### Phase 1: Network and Carrier Import Scripts (3 hours)

1. **Create a Networks Import Script**
   ```javascript
   const { createClient } = require('@supabase/supabase-js');
   require('dotenv').config();
   
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_ANON_KEY
   );
   
   async function importNetworks() {
     const networks = [
       {
         name: 'DNOA',
         code: 'DNOA',
         description: 'Dental Network of America',
         website: 'https://dnoa.com',
         contact_info: { phone: '800-972-7565' },
         guidelines: { general: 'See DNOA Clinical Review Manual for guidelines' }
       },
       // Add more networks based on your documentation
     ];
     
     for (const network of networks) {
       const { data, error } = await supabase
         .from('insurance_networks')
         .upsert(network, { onConflict: 'name' });
       
       if (error) console.error(`Error importing network ${network.name}:`, error);
       else console.log(`Imported network: ${network.name}`);
     }
   }
   
   importNetworks();
   ```

2. **Create a Carriers Import Script**
   ```javascript
   const fs = require('fs');
   const path = require('path');
   const csv = require('csv-parser');
   const { createClient } = require('@supabase/supabase-js');
   require('dotenv').config();
   
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_ANON_KEY
   );
   
   async function getNetworkMap() {
     const { data, error } = await supabase
       .from('insurance_networks')
       .select('id, name');
     
     if (error) throw error;
     
     const networkMap = {};
     data.forEach(network => {
       networkMap[network.name] = network.id;
     });
     
     return networkMap;
   }
   
   async function importCarriers() {
     const networkMap = await getNetworkMap();
     const results = [];
     
     // Read CSV file
     fs.createReadStream('INSURANCE Kam Dental CARRIER LIST.csv')
       .pipe(csv())
       .on('data', (data) => {
         results.push({
           name: data['Insurance Company'],
           payer_id: data['Payer ID'],
           similar_names: JSON.stringify([data['Similar Name']].filter(Boolean)),
           claims_address: data['Claims Address'],
           phone_number: data['Phone Number'],
           network_id: determineNetwork(data['Insurance Company'], networkMap)
         });
       })
       .on('end', async () => {
         console.log(`Found ${results.length} carriers to import`);
         
         // Batch import
         const batchSize = 100;
         for (let i = 0; i < results.length; i += batchSize) {
           const batch = results.slice(i, i + batchSize);
           
           const { error } = await supabase
             .from('insurance_carriers')
             .upsert(batch, { onConflict: 'name' });
           
           if (error) {
             console.error(`Error importing batch ${i/batchSize + 1}:`, error);
           } else {
             console.log(`Imported batch ${i/batchSize + 1} of ${Math.ceil(results.length/batchSize)}`);
           }
         }
       });
   }
   
   // Helper function to determine network
   function determineNetwork(carrierName, networkMap) {
     if (carrierName.includes('BCBS') || carrierName.includes('Blue Cross')) {
       return networkMap['DNOA']; // BCBS carriers are under DNOA
     }
     
     if (carrierName.includes('Delta Dental')) {
       return networkMap['DNOA']; // Delta Dental is under DNOA
     }
     
     // Add more mapping logic based on your documentation
     
     return null; // Default to null if no network match
   }
   
   importCarriers();
   ```

### Phase 2: JSON Data Import (3 hours)

1. **Create a JSON Parsing Script**
   ```javascript
   const fs = require('fs');
   const path = require('path');
   const { createClient } = require('@supabase/supabase-js');
   require('dotenv').config();
   
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_ANON_KEY
   );
   
   async function importJsonData() {
     const parsedDir = path.join(process.cwd(), '@Parsed');
     const files = fs.readdirSync(parsedDir).filter(file => file.endsWith('.json'));
     
     console.log(`Found ${files.length} JSON files to process`);
     
     for (const file of files) {
       const filePath = path.join(parsedDir, file);
       const content = fs.readFileSync(filePath, 'utf8');
       
       try {
         const data = JSON.parse(content);
         const carrierName = path.basename(file, '.json');
         
         console.log(`Processing ${carrierName}...`);
         
         // Get carrier ID
         const { data: carrierData, error: carrierError } = await supabase
           .from('insurance_carriers')
           .select('id')
           .eq('name', carrierName)
           .maybeSingle();
         
         if (carrierError) {
           console.error(`Error finding carrier ${carrierName}:`, carrierError);
           continue;
         }
         
         const carrierId = carrierData?.id;
         
         if (!carrierId) {
           console.log(`Creating new carrier record for ${carrierName}`);
           // Create carrier record if not exists
           const { data: newCarrier, error: createError } = await supabase
             .from('insurance_carriers')
             .insert({ name: carrierName })
             .select()
             .single();
           
           if (createError) {
             console.error(`Error creating carrier ${carrierName}:`, createError);
             continue;
           }
           
           carrierId = newCarrier.id;
         }
         
         // Process procedures if available
         if (data.procedures && Array.isArray(data.procedures)) {
           await importProcedures(data.procedures, carrierId);
         }
         
         // Process guidelines if available
         if (data.guidelines && Array.isArray(data.guidelines)) {
           await importGuidelines(data.guidelines, carrierId);
         }
         
         // Process appeal procedures if available
         if (data.appealProcedures) {
           await importAppealProcedures(data.appealProcedures, carrierId);
         }
         
         console.log(`Completed processing ${carrierName}`);
       } catch (error) {
         console.error(`Error processing ${file}:`, error);
       }
     }
   }
   
   // Helper functions for importing different data types
   async function importProcedures(procedures, carrierId) {
     // Implementation for procedures import
   }
   
   async function importGuidelines(guidelines, carrierId) {
     // Implementation for guidelines import with embeddings
   }
   
   async function importAppealProcedures(appealProcedures, carrierId) {
     // Implementation for appeal procedures import
   }
   
   importJsonData();
   ```

### Phase 3: Data Validation and Testing (2 hours)

1. **Create Validation Queries**
   ```javascript
   const { createClient } = require('@supabase/supabase-js');
   require('dotenv').config();
   
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_ANON_KEY
   );
   
   async function validateData() {
     // Check network counts
     const { data: networks, error: networkError } = await supabase
       .from('insurance_networks')
       .select('*');
     
     if (networkError) {
       console.error('Error fetching networks:', networkError);
     } else {
       console.log(`Found ${networks.length} networks`);
     }
     
     // Check carrier counts
     const { data: carriers, error: carrierError } = await supabase
       .from('insurance_carriers')
       .select('*');
     
     if (carrierError) {
       console.error('Error fetching carriers:', carrierError);
     } else {
       console.log(`Found ${carriers.length} carriers`);
     }
     
     // Check carriers without networks
     const { data: orphanedCarriers, error: orphanError } = await supabase
       .from('insurance_carriers')
       .select('*')
       .is('network_id', null);
     
     if (orphanError) {
       console.error('Error fetching orphaned carriers:', orphanError);
     } else {
       console.log(`Found ${orphanedCarriers.length} carriers without networks`);
     }
     
     // More validation checks...
   }
   
   validateData();
   ```

2. **Create Sample Queries for Agent**
   ```javascript
   async function testQueries() {
     // Test 1: Find carrier by name (exact match)
     const { data: bcbs, error: bcbsError } = await supabase
       .from('insurance_carriers')
       .select('*, insurance_networks!inner(*)')
       .eq('name', 'BCBS of Texas')
       .single();
     
     console.log('BCBS of Texas:', bcbs);
     
     // Test 2: Find carrier by similar name
     const { data: similarCarriers, error: similarError } = await supabase
       .from('insurance_carriers')
       .select('*')
       .contains('similar_names', ['Blue Cross']);
     
     console.log('Carriers with "Blue Cross" in similar names:', similarCarriers);
     
     // Test 3: Find guidelines for a carrier
     const { data: guidelines, error: guidelinesError } = await supabase
       .from('guidelines')
       .select('*')
       .eq('carrier_id', bcbs.id);
     
     console.log('Guidelines for BCBS of Texas:', guidelines);
     
     // More test queries...
   }
   
   testQueries();
   ```

## Day 3: Advanced Database Features

### Phase 1: Create Vector Search for Guidelines (2 hours)

1. **Set Up Embedding Generation**
   ```javascript
   const { createClient } = require('@supabase/supabase-js');
   const { Configuration, OpenAIApi } = require('openai');
   require('dotenv').config();
   
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_ANON_KEY
   );
   
   const configuration = new Configuration({
     apiKey: process.env.OPENAI_API_KEY,
   });
   const openai = new OpenAIApi(configuration);
   
   async function generateEmbeddings() {
     // Get guidelines without embeddings
     const { data: guidelines, error } = await supabase
       .from('guidelines')
       .select('id, content')
       .is('content_embedding', null)
       .limit(10); // Process in batches
     
     if (error) {
       console.error('Error fetching guidelines:', error);
       return;
     }
     
     console.log(`Found ${guidelines.length} guidelines without embeddings`);
     
     for (const guideline of guidelines) {
       try {
         const response = await openai.createEmbedding({
           model: 'text-embedding-ada-002',
           input: guideline.content.substring(0, 8000) // Limit to 8000 chars
         });
         
         const [{ embedding }] = response.data.data;
         
         // Update guideline with embedding
         const { error: updateError } = await supabase
           .from('guidelines')
           .update({ content_embedding: embedding })
           .eq('id', guideline.id);
         
         if (updateError) {
           console.error(`Error updating guideline ${guideline.id}:`, updateError);
         } else {
           console.log(`Updated embedding for guideline ${guideline.id}`);
         }
       } catch (error) {
         console.error(`Error generating embedding for guideline ${guideline.id}:`, error);
       }
     }
   }
   
   generateEmbeddings();
   ```

2. **Create Semantic Search Function**
   ```javascript
   async function semanticSearch(query, limit = 5) {
     // Get embedding for query
     const response = await openai.createEmbedding({
       model: 'text-embedding-ada-002',
       input: query
     });
     
     const [{ embedding }] = response.data.data;
     
     // Perform vector search
     const { data: results, error } = await supabase
       .rpc('match_guidelines', {
         query_embedding: embedding,
         match_threshold: 0.7,
         match_count: limit
       });
     
     if (error) {
       console.error('Error in semantic search:', error);
       return [];
     }
     
     return results;
   }
   ```

### Phase 2: Database Functions and Triggers (2 hours)

1. **Create Functions for Common Query Patterns**
   ```sql
   -- Function to get carrier by name or similar name
   CREATE OR REPLACE FUNCTION get_carrier_by_name(search_name TEXT)
   RETURNS TABLE (
     id INTEGER,
     name TEXT,
     network_id INTEGER,
     network_name TEXT,
     payer_id TEXT,
     claims_address TEXT,
     phone_number TEXT
   ) AS $$
   BEGIN
     RETURN QUERY
     SELECT 
       c.id, 
       c.name, 
       c.network_id, 
       n.name as network_name, 
       c.payer_id, 
       c.claims_address, 
       c.phone_number
     FROM 
       insurance_carriers c
     LEFT JOIN 
       insurance_networks n ON c.network_id = n.id
     WHERE 
       c.name ILIKE '%' || search_name || '%'
       OR c.similar_names::text ILIKE '%' || search_name || '%';
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **Create Triggers for Audit Trail**
   ```sql
   -- Create audit trail table
   CREATE TABLE audit_logs (
     id SERIAL PRIMARY KEY,
     table_name TEXT NOT NULL,
     record_id INTEGER NOT NULL,
     operation TEXT NOT NULL,
     old_data JSONB,
     new_data JSONB,
     changed_by TEXT,
     changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   
   -- Create audit trigger function
   CREATE OR REPLACE FUNCTION audit_trigger_function()
   RETURNS TRIGGER AS $$
   BEGIN
     IF (TG_OP = 'DELETE') THEN
       INSERT INTO audit_logs (table_name, record_id, operation, old_data)
       VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD));
       RETURN OLD;
     ELSIF (TG_OP = 'UPDATE') THEN
       INSERT INTO audit_logs (table_name, record_id, operation, old_data, new_data)
       VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW));
       RETURN NEW;
     ELSIF (TG_OP = 'INSERT') THEN
       INSERT INTO audit_logs (table_name, record_id, operation, new_data)
       VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW));
       RETURN NEW;
     END IF;
     RETURN NULL;
   END;
   $$ LANGUAGE plpgsql;
   
   -- Apply trigger to carrier table
   CREATE TRIGGER audit_insurance_carriers
   AFTER INSERT OR UPDATE OR DELETE ON insurance_carriers
   FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
   ```

### Phase 3: Database Views for Agent Queries (2 hours)

1. **Create Comprehensive Carrier View**
   ```sql
   CREATE VIEW carrier_detail_view AS
   SELECT 
     c.id AS carrier_id,
     c.name AS carrier_name,
     c.payer_id,
     c.claims_address,
     c.phone_number,
     n.id AS network_id,
     n.name AS network_name,
     n.guidelines AS network_guidelines,
     c.guidelines AS carrier_guidelines
   FROM 
     insurance_carriers c
   LEFT JOIN 
     insurance_networks n ON c.network_id = n.id;
   ```

2. **Create Procedure Requirements View**
   ```sql
   CREATE VIEW procedure_requirements_view AS
   SELECT 
     c.id AS carrier_id,
     c.name AS carrier_name,
     p.id AS procedure_id,
     p.code AS procedure_code,
     p.description AS procedure_description,
     p.category AS procedure_category,
     cpr.requirements AS procedure_requirements,
     dr.requirements AS documentation_requirements,
     dr.examples AS documentation_examples
   FROM 
     insurance_carriers c
   JOIN 
     carrier_procedure_requirements cpr ON c.id = cpr.carrier_id
   JOIN 
     procedures p ON cpr.procedure_id = p.id
   LEFT JOIN 
     documentation_requirements dr ON c.id = dr.carrier_id AND p.id = dr.procedure_id;
   ```

## Day 4: API Development for Agent Integration

### Phase 1: Core Data Access Functions (3 hours)

1. **Create Carrier Lookup Functions**
   ```javascript
   const { createClient } = require('@supabase/supabase-js');
   require('dotenv').config();
   
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_ANON_KEY
   );
   
   async function lookupCarrier(carrierName) {
     if (!carrierName) return null;
     
     // First try exact match
     const { data: exactMatch, error: exactError } = await supabase
       .from('insurance_carriers')
       .select('*, insurance_networks(*)')
       .eq('name', carrierName)
       .maybeSingle();
     
     if (!exactError && exactMatch) {
       return exactMatch;
     }
     
     // Try similar name
     const { data: similarMatches, error: similarError } = await supabase
       .from('insurance_carriers')
       .select('*, insurance_networks(*)')
       .or(`name.ilike.%${carrierName}%,similar_names.ilike.%${carrierName}%`)
       .limit(5);
     
     if (similarError) {
       console.error('Error looking up carrier by similar name:', similarError);
       return null;
     }
     
     if (similarMatches && similarMatches.length > 0) {
       return similarMatches[0]; // Return the first match
     }
     
     // Try fuzzy match
     // This would depend on PostgreSQL extensions or custom implementation
     
     return null;
   }
   
   module.exports = { lookupCarrier };
   ```

2. **Create Procedure Lookup Functions**
   ```javascript
   async function lookupProcedure(procedureCode, carrierId) {
     if (!procedureCode) return null;
     
     const { data: procedure, error: procedureError } = await supabase
       .from('procedures')
       .select('*')
       .eq('code', procedureCode)
       .maybeSingle();
     
     if (procedureError) {
       console.error('Error looking up procedure:', procedureError);
       return null;
     }
     
     if (!procedure) return null;
     
     if (carrierId) {
       // Get carrier-specific requirements
       const { data: requirements, error: reqError } = await supabase
         .from('carrier_procedure_requirements')
         .select('*')
         .eq('carrier_id', carrierId)
         .eq('procedure_id', procedure.id)
         .maybeSingle();
       
       if (!reqError && requirements) {
         procedure.requirements = requirements.requirements;
       }
       
       // Get documentation requirements
       const { data: docReqs, error: docError } = await supabase
         .from('documentation_requirements')
         .select('*')
         .eq('carrier_id', carrierId)
         .eq('procedure_id', procedure.id)
         .maybeSingle();
       
       if (!docError && docReqs) {
         procedure.documentation_requirements = docReqs.requirements;
         procedure.documentation_examples = docReqs.examples;
       }
     }
     
     return procedure;
   }
   
   module.exports = { lookupCarrier, lookupProcedure };
   ```

### Phase 2: Advanced Query Functions (3 hours)

1. **Create Guidelines Search Function**
   ```javascript
   async function searchGuidelines(query, carrierId = null) {
     // If carrierId provided, limit to that carrier
     let filter = '';
     if (carrierId) {
       filter = `&carrier_id=eq.${carrierId}`;
     }
     
     // First try text search
     const { data: textResults, error: textError } = await supabase
       .from('guidelines')
       .select('*, insurance_carriers!inner(name)')
       .textSearch('content', query)
       .order('created_at', { ascending: false })
       .limit(5);
     
     if (!textError && textResults && textResults.length > 0) {
       return textResults;
     }
     
     // If no results or error, try semantic search
     try {
       const semanticResults = await semanticSearch(query, 5);
       return semanticResults;
     } catch (error) {
       console.error('Error in semantic search:', error);
       return [];
     }
   }
   ```

2. **Create Network-Based Query Function**
   ```javascript
   async function getCarriersByNetwork(networkName) {
     if (!networkName) return [];
     
     const { data: network, error: networkError } = await supabase
       .from('insurance_networks')
       .select('id')
       .eq('name', networkName)
       .maybeSingle();
     
     if (networkError || !network) {
       console.error('Error finding network:', networkError);
       return [];
     }
     
     const { data: carriers, error: carriersError } = await supabase
       .from('insurance_carriers')
       .select('*')
       .eq('network_id', network.id);
     
     if (carriersError) {
       console.error('Error finding carriers by network:', carriersError);
       return [];
     }
     
     return carriers || [];
   }
   ```

### Phase 3: Integration Testing and Documentation (2 hours)

1. **Create Simple REST API for Testing**
   ```javascript
   const express = require('express');
   const cors = require('cors');
   const { lookupCarrier, lookupProcedure, searchGuidelines } = require('./database');
   
   const app = express();
   app.use(cors());
   app.use(express.json());
   
   // Carrier lookup endpoint
   app.get('/api/carriers/:name', async (req, res) => {
     try {
       const carrier = await lookupCarrier(req.params.name);
       if (!carrier) {
         return res.status(404).json({ error: 'Carrier not found' });
       }
       res.json(carrier);
     } catch (error) {
       console.error('Error looking up carrier:', error);
       res.status(500).json({ error: 'Internal server error' });
     }
   });
   
   // Procedure lookup endpoint
   app.get('/api/procedures/:code', async (req, res) => {
     try {
       const carrierId = req.query.carrierId;
       const procedure = await lookupProcedure(req.params.code, carrierId);
       if (!procedure) {
         return res.status(404).json({ error: 'Procedure not found' });
       }
       res.json(procedure);
     } catch (error) {
       console.error('Error looking up procedure:', error);
       res.status(500).json({ error: 'Internal server error' });
     }
   });
   
   // Guidelines search endpoint
   app.get('/api/guidelines/search', async (req, res) => {
     try {
       const { q, carrierId } = req.query;
       if (!q) {
         return res.status(400).json({ error: 'Query parameter is required' });
       }
       const results = await searchGuidelines(q, carrierId);
       res.json(results);
     } catch (error) {
       console.error('Error searching guidelines:', error);
       res.status(500).json({ error: 'Internal server error' });
     }
   });
   
   const PORT = process.env.PORT || 3000;
   app.listen(PORT, () => {
     console.log(`Server running on port ${PORT}`);
   });
   ```

2. **Create API Documentation**
   ```javascript
   // Generate OpenAPI spec for API documentation
   const swaggerJsDoc = require('swagger-jsdoc');
   const swaggerUi = require('swagger-ui-express');
   
   const swaggerOptions = {
     swaggerDefinition: {
       openapi: '3.0.0',
       info: {
         title: 'Dental Insurance API',
         version: '1.0.0',
         description: 'API for dental insurance information',
       },
       servers: [
         {
           url: 'http://localhost:3000',
           description: 'Development server',
         },
       ],
     },
     apis: ['./server.js'],
   };
   
   const swaggerDocs = swaggerJsDoc(swaggerOptions);
   app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
   ```

## Final Deliverables

1. **Complete Database Schema**
   - SQL scripts for all tables, indexes, functions, triggers, and views
   - Documentation of schema design and relationships

2. **Data Import Tools**
   - Scripts for importing networks, carriers, and other data
   - Validation tools to ensure data integrity

3. **Query API**
   - JavaScript functions for common queries
   - Simple REST API for testing

4. **Documentation**
   - API documentation
   - Database schema documentation
   - Sample queries for agent integration

This comprehensive plan will give you a robust insurance database that captures the network-carrier-plan relationships and provides powerful query capabilities for your AI agent to leverage.