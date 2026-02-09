/**
 * Store Test Emails in KV - Actually put the emails in Cloudflare KV
 */

import { getCompleteWhitelist, isEmailWhitelisted } from '../src/3_workFlowEntrypoints/email/whitelist-worker';

interface Email {
    id: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    date: string;
    messageId: string;
}

// Test emails that should be stored
const TEST_EMAILS: Email[] = [
    {
        id: "ico-001",
        from: "casework@ico.org.uk",
        to: "rose@mobicycle.ee",
        subject: "Data Protection Complaint Investigation",
        body: "We are investigating your complaint reference ICO-123456. Please provide additional information about the data processing activities that led to this complaint.",
        date: new Date().toISOString(),
        messageId: "<ico-001@ico.org.uk>"
    },
    {
        id: "foi-001", 
        from: "foi@ico.org.uk",
        to: "rose@mobicycle.ee",
        subject: "Freedom of Information Request Response",
        body: "Your FOI request has been processed. Reference: FOI-2024-789. Please find the requested information attached.",
        date: new Date().toISOString(),
        messageId: "<foi-001@ico.org.uk>"
    },
    {
        id: "supreme-001",
        from: "admin@supremecourt.uk", 
        to: "rose@mobicycle.ee",
        subject: "Appeal Case Update - SC/2024/0156",
        body: "Regarding your appeal case SC/2024/0156. The court has scheduled a hearing for March 15, 2024.",
        date: new Date().toISOString(),
        messageId: "<supreme-001@supremecourt.uk>"
    },
    {
        id: "estonia-001",
        from: "legal@gov.ee",
        to: "rose@mobicycle.ee", 
        subject: "Estonian Legal Proceeding Notice",
        body: "Reference to legal proceedings in Estonia case EE-2024-001. Court date scheduled.",
        date: new Date().toISOString(),
        messageId: "<estonia-001@gov.ee>"
    }
];

console.log("📧 Storing test emails in Cloudflare KV namespaces...\n");

const whitelist = getCompleteWhitelist();

for (const email of TEST_EMAILS) {
    console.log(`Processing: ${email.from} -> "${email.subject}"`);
    
    const whitelistResult = isEmailWhitelisted(email.from, whitelist);
    
    if (whitelistResult.allowed && whitelistResult.tags?.kvNamespace) {
        // Create email key
        const emailDate = new Date(email.date);
        const year = emailDate.getUTCFullYear();
        const day = emailDate.getUTCDate().toString().padStart(2, '0');
        const month = (emailDate.getUTCMonth() + 1).toString().padStart(2, '0');
        const dateStr = `${year}.${day}.${month}`;
        const hours = emailDate.getUTCHours().toString().padStart(2, '0');
        const minutes = emailDate.getUTCMinutes().toString().padStart(2, '0');
        const seconds = emailDate.getUTCSeconds().toString().padStart(2, '0');
        const timeStr = `${hours}-${minutes}-${seconds}`;
        const senderKey = email.from.replace(/[@.]/g, '_');
        const emailKey = `${dateStr}_${senderKey}_${timeStr}`;
        
        const emailData = {
            originalId: email.id,
            key: emailKey,
            from: email.from,
            to: email.to,
            subject: email.subject,
            body: email.body,
            date: email.date,
            messageId: email.messageId,
            whitelistMatch: {
                pattern: whitelistResult.matchedPattern,
                categories: whitelistResult.categories,
                tags: whitelistResult.tags
            },
            storedAt: new Date().toISOString()
        };
        
        console.log(`  ✅ Storing in KV: ${whitelistResult.tags.kvNamespace[0]}`);
        console.log(`  🔑 Key: ${emailKey}`);
        
        // Output the wrangler command to store this email
        const kvNamespace = whitelistResult.tags.kvNamespace[0];
        const emailDataJson = JSON.stringify(emailData);
        
        console.log(`\nwrangler kv key put --binding CASE_HISTORY "${emailKey}" '${emailDataJson}' --preview\n`);
    } else {
        console.log(`  ❌ Not whitelisted - would be blocked`);
    }
}

console.log("\n📊 Summary:");
console.log("Run the above wrangler commands to store the emails in KV.");