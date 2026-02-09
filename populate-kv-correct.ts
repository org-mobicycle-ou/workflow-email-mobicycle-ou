#!/usr/bin/env bun

/**
 * Populate MobiCycle OÜ's 35 Email KV Namespaces
 * For rose@mobicycle.ee ONLY
 */

const ACCOUNT_ID = '2e4a7955aa124c38058cccd43902a8a5'; // MobiCycle OÜ
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const EMAIL = 'rose@mobicycle.ee';
const BACKEND_URL = process.env.TUNNEL_URL || 'https://imap.mobicycle.ee';

// ALL 35 KV Namespaces from wrangler.jsonc
const namespaces = [
  // Courts (7)
  { binding: 'EMAIL_COURTS_SUPREME_COURT', id: '4272a9a3567b4827b3e6b07a9e0ec07b' },
  { binding: 'EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION', id: 'd730d43a0ff5452b9aa387fd6ab2640e' },
  { binding: 'EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION', id: 'ab4eb2fdf4844dab802e5006c53fed91' },
  { binding: 'EMAIL_COURTS_CHANCERY_DIVISION', id: 'c0e294c679194bb2921f6faa83826d56' },
  { binding: 'EMAIL_COURTS_ADMINISTRATIVE_COURT', id: '37c7b5e5e8a84e2a8e340cb0e1b39202' },
  { binding: 'EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT', id: '0dd9a961f8e54104a1c784fdd736d354' },
  { binding: 'EMAIL_COURTS_CLERKENWELL_COUNTY_COURT', id: '450d57986f6b47bd8e6a9881d48b0222' },

  // Complaints (5)
  { binding: 'EMAIL_COMPLAINTS_ICO', id: 'e13127c545d646d8bbad29c8832193e7' },
  { binding: 'EMAIL_COMPLAINTS_PHSO', id: 'c336442195044b38b0b44fb6a7bc0c85' },
  { binding: 'EMAIL_COMPLAINTS_PARLIAMENT', id: 'dfff26c86d844c1eada2658f98cc5043' },
  { binding: 'EMAIL_COMPLAINTS_HMCTS', id: '1f2e69dfa5db49959b5c8f98d87453d6' },
  { binding: 'EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD', id: '142319de0a894f6da1b35ebf457b910f' },

  // Legal Expenses (4)
  { binding: 'EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT', id: 'e2138bc141724569bca4a006b370c94e' },
  { binding: 'EMAIL_EXPENSES_LEGAL_FEES_COMPANY', id: 'c439324554544228b5c722a27119f47e' },
  { binding: 'EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR', id: '226bdfd1f03e46e6a48ae5b77c00a264' },
  { binding: 'EMAIL_EXPENSES_REPAIRS', id: '2155671bd23047bb917a7af169640691' },

  // Claimants (4)
  { binding: 'EMAIL_CLAIMANT_HK_LAW', id: '6569a3d0c87b4ad897280e25695a7858' },
  { binding: 'EMAIL_CLAIMANT_LESSEL', id: 'f94de5c0cb584d8596fcfecf853f4213' },
  { binding: 'EMAIL_CLAIMANT_LIU', id: 'aac7e7e16f87490ba571aa9854c11e8c' },
  { binding: 'EMAIL_CLAIMANT_RENTIFY', id: '61d3e5e7b3e94cfab6db2aca6d05869a' },

  // Defendants (5)
  { binding: 'EMAIL_DEFENDANTS_DEFENDANT', id: '38a222851c034b6ab8c018fcbd5c4079' },
  { binding: 'EMAIL_DEFENDANTS_BOTH_DEFENDANTS', id: 'e1305af8eb8d44b28d6838e2516ae122' },
  { binding: 'EMAIL_DEFENDANTS_BARRISTERS', id: '25c9d3da2ba6446883842413b3daa814' },
  { binding: 'EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY', id: 'a71c5d09502e40b08522e1b5d7f0127c' },
  { binding: 'EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY', id: '6ed1b38a555a4517bb272013b6140acb' },

  // Government (3)
  { binding: 'EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT', id: 'da78dcd3387040478f852eccd7fa47eb' },
  { binding: 'EMAIL_GOVERNMENT_ESTONIA', id: 'e45e1cd170a04580828ac7f88c34c8f8' },
  { binding: 'EMAIL_GOVERNMENT_US_STATE_DEPARTMENT', id: '36b5178e1c83446faab3953bc49da196' },

  // Reconsideration (7)
  { binding: 'EMAIL_RECONSIDERATION_SINGLE_JUDGE', id: '300bb71748194533bd1b25288263aeba' },
  { binding: 'EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW', id: '513fc3d8c841423d853123e0c6cdfb80' },
  { binding: 'EMAIL_RECONSIDERATION_PTA_REFUSAL', id: 'e2b36cf5a9a8422ca589af783cfaf37c' },
  { binding: 'EMAIL_RECONSIDERATION_CPR52_24_5', id: 'a3393dce32fb4ae69464697e9fd215f0' },
  { binding: 'EMAIL_RECONSIDERATION_CPR52_24_6', id: '3117bed7263743ab901115e7a0b5a803' },
  { binding: 'EMAIL_RECONSIDERATION_CPR52_30', id: '4598ae69628a49e2a17e1e0b56ad77e7' },
  { binding: 'EMAIL_RECONSIDERATION_PD52B', id: '9caf10194efb4a4d8296ac730793960b' },
];

async function writeToKV(namespaceId: string, key: string, value: any) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to write to KV: ${response.status} ${error}`);
  }

  return response.json();
}

async function getEmailCounts(binding: string) {
  // Convert binding to label format
  // e.g. EMAIL_COURTS_SUPREME_COURT -> supreme_court or Supreme Court
  const label = binding.replace('EMAIL_', '').replace(/_/g, ' ').toLowerCase();

  try {
    // Try backend API if available
    const encodedEmail = encodeURIComponent(EMAIL);
    const encodedLabel = encodeURIComponent(label);

    const [sentResponse, receivedResponse] = await Promise.all([
      fetch(`${BACKEND_URL}/label-sent/${encodedLabel}?email=${encodedEmail}`).catch(() => null),
      fetch(`${BACKEND_URL}/label-received/${encodedLabel}?email=${encodedEmail}`).catch(() => null),
    ]);

    if (sentResponse?.ok && receivedResponse?.ok) {
      const sentData = await sentResponse.json();
      const receivedData = await receivedResponse.json();
      return {
        sent: sentData.sentEmails || 0,
        received: receivedData.receivedEmails || 0,
      };
    }
  } catch (error) {
    console.warn(`  Could not fetch from backend: ${error.message}`);
  }

  // If backend fails, return 0 (KV will be populated later when backend is available)
  return { sent: 0, received: 0 };
}

async function populateNamespace(namespace: typeof namespaces[0]) {
  console.log(`\nPopulating ${namespace.binding}...`);

  try {
    const counts = await getEmailCounts(namespace.binding);

    const data = {
      email: EMAIL,
      binding: namespace.binding,
      sentEmails: counts.sent,
      receivedEmails: counts.received,
      lastUpdated: new Date().toISOString(),
      status: 'pending', // Emails need to be processed
    };

    await writeToKV(namespace.id, EMAIL, data);
    console.log(`  ✓ sent=${counts.sent}, received=${counts.received}`);
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
  }
}

async function main() {
  if (!API_TOKEN) {
    console.error('Error: CLOUDFLARE_API_TOKEN environment variable not set');
    console.error('Export it first: export CLOUDFLARE_API_TOKEN="your-token"');
    process.exit(1);
  }

  console.log('========================================');
  console.log('Populating MobiCycle OÜ Email KV Namespaces');
  console.log('========================================\n');
  console.log(`Account: ${ACCOUNT_ID}`);
  console.log(`Email: ${EMAIL}`);
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Namespaces: ${namespaces.length}\n`);

  for (const namespace of namespaces) {
    await populateNamespace(namespace);
  }

  console.log('\n========================================');
  console.log('✅ All 35 KV namespaces populated!');
  console.log('========================================');
}

main().catch(console.error);
