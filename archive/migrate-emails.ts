#!/usr/bin/env bun

/**
 * Email Migration Script
 * Fetches emails from IMAP server and distributes them to KV namespaces
 */

const BACKEND_URL = 'http://localhost:4000';
const DISTRIBUTOR_URL = 'http://localhost:8788';

interface EmailFetchRequest {
  account: string;
  daysBack: number;
}

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  headers: Record<string, string>;
}

async function fetchEmailsFromIMAP(account: string, daysBack: number): Promise<Email[]> {
  console.log(`📡 Fetching emails for account: ${account} (last ${daysBack} days)`);
  
  try {
    const response = await fetch(`${BACKEND_URL}/fetch-emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ account, daysBack } as EmailFetchRequest),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.status} ${response.statusText}`);
    }

    const emails = await response.json() as Email[];
    console.log(`✅ Successfully fetched ${emails.length} emails from IMAP`);
    return emails;
  } catch (error) {
    console.error(`❌ Error fetching emails from IMAP:`, error);
    throw error;
  }
}

async function distributeEmails(emails: Email[]): Promise<void> {
  console.log(`📋 Distributing ${emails.length} emails to KV namespaces...`);
  
  try {
    const response = await fetch(`${DISTRIBUTOR_URL}/distribute-emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emails }),
    });

    if (!response.ok) {
      throw new Error(`Failed to distribute emails: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ Successfully distributed emails to KV namespaces:`, result);
  } catch (error) {
    console.error(`❌ Error distributing emails:`, error);
    throw error;
  }
}

async function fetchAndDistribute(account: string, daysBack: number): Promise<void> {
  console.log(`🚀 Using integrated fetch-and-distribute endpoint...`);
  
  try {
    const response = await fetch(`${DISTRIBUTOR_URL}/fetch-and-distribute?account=${account}&daysBack=${daysBack}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch and distribute: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ Successfully completed fetch and distribute:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Error in fetch-and-distribute:`, error);
    throw error;
  }
}

async function migrateEmails(account: string = 'mobicycle', daysBack: number = 30): Promise<void> {
  console.log(`🔄 Starting email migration for account: ${account}`);
  console.log(`📅 Fetching emails from last ${daysBack} days`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('─'.repeat(60));

  try {
    // Method 1: Use the integrated fetch-and-distribute endpoint (recommended)
    await fetchAndDistribute(account, daysBack);
    
    console.log('─'.repeat(60));
    console.log(`✅ Migration completed successfully!`);
    console.log(`⏰ Completed at: ${new Date().toISOString()}`);
    
  } catch (error) {
    console.log('⚠️  Integrated endpoint failed, trying manual approach...');
    
    try {
      // Method 2: Manual fetch and distribute (fallback)
      const emails = await fetchEmailsFromIMAP(account, daysBack);
      
      if (emails.length === 0) {
        console.log('📭 No emails found to migrate.');
        return;
      }
      
      await distributeEmails(emails);
      
      console.log('─'.repeat(60));
      console.log(`✅ Migration completed successfully (manual method)!`);
      console.log(`📊 Total emails processed: ${emails.length}`);
      console.log(`⏰ Completed at: ${new Date().toISOString()}`);
      
    } catch (fallbackError) {
      console.error('❌ Migration failed with both methods:');
      console.error('  Integrated endpoint error:', error);
      console.error('  Manual method error:', fallbackError);
      process.exit(1);
    }
  }
}

// Run the migration
if (import.meta.main) {
  const account = process.argv[2] || 'mobicycle';
  const daysBack = parseInt(process.argv[3]) || 30;
  
  migrateEmails(account, daysBack).catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
}