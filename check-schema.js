#!/usr/bin/env node
/**
 * Card Show Finder - Check Database Schema
 * 
 * This script inspects the actual database schema for the scraped_shows_pending and shows tables.
 * It queries the information_schema to get column names and types, and displays sample records.
 * 
 * Usage:
 *   node check-schema.js [--samples=N]
 * 
 * Options:
 *   --samples=N  Number of sample records to display (default: 2)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Parse command line arguments
const args = process.argv.slice(2);
let sampleSize = 2;

// Check for samples argument
const samplesArg = args.find(arg => arg.startsWith('--samples='));
if (samplesArg) {
  const value = parseInt(samplesArg.split('=')[1], 10);
  if (!isNaN(value) && value > 0) {
    sampleSize = value;
  }
}

/**
 * Main function to check database schema
 */
async function checkSchema() {
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  CARD SHOW FINDER - DATABASE SCHEMA INSPECTOR${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}\n`);
  
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    console.log(`${colors.cyan}Connecting to database...${colors.reset}`);
    console.log(`${colors.dim}URL: ${process.env.EXPO_PUBLIC_SUPABASE_URL}${colors.reset}`);
    
    // Get database schema information
    const tables = ['scraped_shows_pending', 'shows'];
    
    for (const tableName of tables) {
      console.log(`\n${colors.bright}${colors.blue}TABLE: ${tableName}${colors.reset}\n`);
      
      // Check if table exists
      const { tableExists, error: tableError } = await checkTableExists(supabase, tableName);
      
      if (tableError) {
        console.error(`${colors.red}Error checking table: ${tableError.message}${colors.reset}`);
        continue;
      }
      
      if (!tableExists) {
        console.log(`${colors.yellow}Table '${tableName}' does not exist${colors.reset}`);
        continue;
      }
      
      // Get column information
      const { columns, error: columnsError } = await getTableColumns(supabase, tableName);
      
      if (columnsError) {
        console.error(`${colors.red}Error getting columns: ${columnsError.message}${colors.reset}`);
        continue;
      }
      
      // Display column information
      console.log(`${colors.bright}COLUMNS:${colors.reset}`);
      console.log(`${colors.dim}┌────────────────────────┬──────────────────────┬─────────┬─────────┐${colors.reset}`);
      console.log(`${colors.dim}│ ${colors.bright}Column Name${colors.dim}            │ ${colors.bright}Data Type${colors.dim}            │ ${colors.bright}Nullable${colors.dim} │ ${colors.bright}Default${colors.dim} │${colors.reset}`);
      console.log(`${colors.dim}├────────────────────────┼──────────────────────┼─────────┼─────────┤${colors.reset}`);
      
      columns.forEach(col => {
        const name = col.column_name.padEnd(24).substring(0, 24);
        const type = col.data_type.padEnd(22).substring(0, 22);
        const nullable = (col.is_nullable === 'YES' ? 'YES' : 'NO').padEnd(9).substring(0, 9);
        const defaultVal = (col.column_default || '').toString().padEnd(9).substring(0, 9);
        
        console.log(`${colors.dim}│ ${colors.reset}${name} ${colors.dim}│ ${colors.reset}${type} ${colors.dim}│ ${colors.reset}${nullable} ${colors.dim}│ ${colors.reset}${defaultVal} ${colors.dim}│${colors.reset}`);
      });
      
      console.log(`${colors.dim}└────────────────────────┴──────────────────────┴─────────┴─────────┘${colors.reset}`);
      
      // Get sample records
      const { samples, error: samplesError } = await getSampleRecords(supabase, tableName, sampleSize);
      
      if (samplesError) {
        console.error(`${colors.red}Error getting samples: ${samplesError.message}${colors.reset}`);
        continue;
      }
      
      // Display sample records
      console.log(`\n${colors.bright}SAMPLE RECORDS (${samples.length}):${colors.reset}\n`);
      
      if (samples.length === 0) {
        console.log(`${colors.yellow}No records found in table${colors.reset}`);
      } else {
        samples.forEach((record, index) => {
          console.log(`${colors.cyan}Record #${index + 1}:${colors.reset}`);
          
          // Format record for display
          const formattedRecord = formatRecord(record);
          console.log(formattedRecord);
          
          if (index < samples.length - 1) {
            console.log(''); // Add space between records
          }
        });
      }
      
      // Check for JSON columns and display structure
      const jsonColumns = columns.filter(col => 
        col.data_type === 'json' || col.data_type === 'jsonb'
      );
      
      if (jsonColumns.length > 0 && samples.length > 0) {
        console.log(`\n${colors.bright}JSON COLUMN STRUCTURE:${colors.reset}\n`);
        
        for (const jsonCol of jsonColumns) {
          const colName = jsonCol.column_name;
          const sampleValue = samples.find(s => s[colName] && Object.keys(s[colName]).length > 0);
          
          if (sampleValue && sampleValue[colName]) {
            console.log(`${colors.cyan}Column: ${colName}${colors.reset}`);
            console.log(`${colors.dim}Structure:${colors.reset}`);
            
            try {
              const structure = getJsonStructure(sampleValue[colName]);
              console.log(structure);
            } catch (e) {
              console.log(`${colors.yellow}Could not parse JSON structure${colors.reset}`);
            }
            
            console.log('');
          }
        }
      }
    }
    
    // Check for related tables
    console.log(`\n${colors.bright}${colors.blue}CHECKING FOR RELATED TABLES${colors.reset}\n`);
    
    const relatedTables = [
      'show_series',
      'series_ownership',
      'users',
      'profiles'
    ];
    
    for (const tableName of relatedTables) {
      const { tableExists, error: tableError } = await checkTableExists(supabase, tableName);
      
      if (tableError) {
        console.log(`${colors.red}Error checking table '${tableName}': ${tableError.message}${colors.reset}`);
        continue;
      }
      
      if (tableExists) {
        console.log(`${colors.green}✓ Table '${tableName}' exists${colors.reset}`);
        
        // Get column count
        const { columns, error: columnsError } = await getTableColumns(supabase, tableName);
        
        if (!columnsError) {
          console.log(`  ${colors.dim}Columns: ${columns.length}${colors.reset}`);
          
          // List key columns
          const keyColumns = columns
            .filter(col => col.column_name === 'id' || col.column_name.endsWith('_id'))
            .map(col => col.column_name);
          
          if (keyColumns.length > 0) {
            console.log(`  ${colors.dim}Key columns: ${keyColumns.join(', ')}${colors.reset}`);
          }
        }
      } else {
        console.log(`${colors.yellow}Table '${tableName}' does not exist${colors.reset}`);
      }
    }
    
    console.log(`\n${colors.bright}${colors.green}SCHEMA INSPECTION COMPLETE!${colors.reset}`);
    console.log(`You can now create the correct insert script based on the actual schema.`);
    
  } catch (error) {
    console.error(`\n${colors.red}UNEXPECTED ERROR: ${error.message}${colors.reset}`);
    console.error(`${colors.dim}${error.stack}${colors.reset}`);
  }
}

/**
 * Check if a table exists
 */
async function checkTableExists(supabase, tableName) {
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', tableName)
      .limit(1);
    
    if (error) {
      // Try alternative method if information_schema is not accessible
      try {
        const { data: altData, error: altError } = await supabase
          .from(tableName)
          .select('id')
          .limit(1);
        
        if (altError && altError.message.includes('does not exist')) {
          return { tableExists: false, error: null };
        }
        
        return { tableExists: true, error: null };
      } catch (altError) {
        return { tableExists: false, error: altError };
      }
    }
    
    return { tableExists: data && data.length > 0, error: null };
  } catch (error) {
    return { tableExists: false, error };
  }
}

/**
 * Get column information for a table
 */
async function getTableColumns(supabase, tableName) {
  try {
    // Try to query information_schema
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', tableName)
      .order('ordinal_position', { ascending: true });
    
    if (error) {
      // If information_schema is not accessible, try to infer from a sample record
      try {
        const { data: sampleData, error: sampleError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (sampleError) {
          return { columns: [], error: sampleError };
        }
        
        if (sampleData && sampleData.length > 0) {
          const inferredColumns = Object.keys(sampleData[0]).map(key => ({
            column_name: key,
            data_type: typeof sampleData[0][key] === 'object' ? 'json' : typeof sampleData[0][key],
            is_nullable: 'UNKNOWN',
            column_default: null
          }));
          
          return { columns: inferredColumns, error: null };
        }
        
        return { columns: [], error: null };
      } catch (inferError) {
        return { columns: [], error: inferError };
      }
    }
    
    return { columns: data, error: null };
  } catch (error) {
    return { columns: [], error };
  }
}

/**
 * Get sample records from a table
 */
async function getSampleRecords(supabase, tableName, limit) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(limit);
    
    return { samples: data || [], error };
  } catch (error) {
    return { samples: [], error };
  }
}

/**
 * Format a record for display
 */
function formatRecord(record) {
  const output = [];
  
  for (const [key, value] of Object.entries(record)) {
    if (value === null) {
      output.push(`  ${colors.dim}${key}:${colors.reset} ${colors.yellow}null${colors.reset}`);
    } else if (typeof value === 'object') {
      try {
        const jsonString = JSON.stringify(value, null, 2);
        output.push(`  ${colors.dim}${key}:${colors.reset} ${colors.yellow}[Object]${colors.reset}`);
        
        // Only show first few lines if it's large
        if (jsonString.length > 500) {
          const truncated = jsonString.substring(0, 500);
          output.push(`    ${colors.dim}${truncated}...${colors.reset} ${colors.yellow}[truncated]${colors.reset}`);
        } else {
          output.push(`    ${colors.dim}${jsonString}${colors.reset}`);
        }
      } catch (e) {
        output.push(`  ${colors.dim}${key}:${colors.reset} ${colors.yellow}[Complex Object]${colors.reset}`);
      }
    } else {
      output.push(`  ${colors.dim}${key}:${colors.reset} ${value}`);
    }
  }
  
  return output.join('\n');
}

/**
 * Get structure of a JSON object
 */
function getJsonStructure(obj, level = 0) {
  const indent = '  '.repeat(level);
  const output = [];
  
  if (Array.isArray(obj)) {
    output.push(`${indent}Array [${obj.length} items]`);
    
    if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
      output.push(getJsonStructure(obj[0], level + 1));
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (value === null) {
        output.push(`${indent}${key}: null`);
      } else if (typeof value === 'object') {
        output.push(`${indent}${key}: ${Array.isArray(value) ? 'Array' : 'Object'}`);
        output.push(getJsonStructure(value, level + 1));
      } else {
        output.push(`${indent}${key}: ${typeof value}`);
      }
    }
  }
  
  return output.join('\n');
}

// Run the script
checkSchema().catch(console.error);
