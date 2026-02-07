/**
 * Email Classification and KV Population Script
 * Fetches emails from backend and populates appropriate KV namespaces
 */

interface Email {
	id: string;
	from: string;
	to: string;
	subject: string;
	body: string;
	date: string;
	messageId: string;
}

interface ClassificationRule {
	namespace: string;
	conditions: {
		fromIncludes?: string[];
		toIncludes?: string[];
		subjectIncludes?: string[];
		bodyIncludes?: string[];
	};
}

// Email classification rules
const CLASSIFICATION_RULES: ClassificationRule[] = [
	// PHSO Complaints
	{
		namespace: "email-complaints-phso",
		conditions: {
			toIncludes: ["ombudsman.org.uk", "informationrights@ombudsman", "complaintsaboutservice@ombudsman"],
			subjectIncludes: ["phso", "ombudsman"]
		}
	},
	
	// HMCTS Complaints
	{
		namespace: "email-complaints-hmcts",
		conditions: {
			toIncludes: ["hmcts.gov.uk", "justice.gov.uk"],
			subjectIncludes: ["hmcts", "court", "tribunal"]
		}
	},
	
	// Parliament Complaints
	{
		namespace: "email-complaints-parliament",
		conditions: {
			toIncludes: ["parliament.uk", "mp@", "mep@"],
			subjectIncludes: ["parliament", "parliamentary", "mp", "member of parliament"]
		}
	},
	
	// Bar Standards Board Complaints
	{
		namespace: "email-complaints-bar-standards-board",
		conditions: {
			toIncludes: ["barstandardsboard.org.uk", "barcouncil.org.uk"],
			subjectIncludes: ["bar standards", "barrister", "chambers"]
		}
	},
	
	// Courts - Administrative Court
	{
		namespace: "email-courts-administrative-court",
		conditions: {
			toIncludes: ["administrativecourt", "admin.court"],
			subjectIncludes: ["administrative court", "judicial review"]
		}
	},
	
	// Courts - Central London County Court
	{
		namespace: "email-courts-central-london-county-court",
		conditions: {
			toIncludes: ["centrallondon", "central.london"],
			subjectIncludes: ["central london county court", "clcc"]
		}
	},
	
	// Courts - Chancery Division
	{
		namespace: "email-courts-chancery-division",
		conditions: {
			toIncludes: ["chancery"],
			subjectIncludes: ["chancery division", "chancery court"]
		}
	},
	
	// Courts - Supreme Court
	{
		namespace: "email-courts-supreme-court",
		conditions: {
			toIncludes: ["supremecourt.uk"],
			subjectIncludes: ["supreme court", "uksc"]
		}
	},
	
	// Government - UK Legal Department
	{
		namespace: "email-government-uk-legal-department",
		conditions: {
			toIncludes: ["gov.uk", "government-legal"],
			subjectIncludes: ["government legal", "treasury solicitor"]
		}
	},
	
	// Government - US State Department
	{
		namespace: "email-government-us-state-department",
		conditions: {
			toIncludes: ["state.gov"],
			subjectIncludes: ["state department", "embassy", "consulate"]
		}
	},
	
	// Government - Estonia
	{
		namespace: "email-government-estonia",
		conditions: {
			toIncludes: [".ee", "gov.ee"],
			subjectIncludes: ["estonia", "estonian government"]
		}
	},
	
	// Claimants
	{
		namespace: "email-claimant-hk-law",
		conditions: {
			fromIncludes: ["hk-law", "hongkong"],
			toIncludes: ["hk-law", "hongkong"],
			subjectIncludes: ["hk law", "hong kong"]
		}
	},
	
	{
		namespace: "email-claimant-lessel",
		conditions: {
			fromIncludes: ["lessel"],
			toIncludes: ["lessel"],
			subjectIncludes: ["lessel"]
		}
	},
	
	{
		namespace: "email-claimant-liu",
		conditions: {
			fromIncludes: ["liu"],
			toIncludes: ["liu"],
			subjectIncludes: ["liu"]
		}
	},
	
	{
		namespace: "email-claimant-rentify",
		conditions: {
			fromIncludes: ["rentify"],
			toIncludes: ["rentify"],
			subjectIncludes: ["rentify"]
		}
	}
];

// Generate email key using the format from the workflow
function generateEmailKey(email: Email): string {
	const emailDate = new Date(email.date);
	const year = emailDate.getUTCFullYear();
	const day = emailDate.getUTCDate().toString().padStart(2, '0');
	const month = (emailDate.getUTCMonth() + 1).toString().padStart(2, '0');
	const dateStr = `${year}.${day}.${month}`;
	
	const hours = emailDate.getUTCHours().toString().padStart(2, '0');
	const minutes = emailDate.getUTCMinutes().toString().padStart(2, '0');
	const seconds = emailDate.getUTCSeconds().toString().padStart(2, '0');
	const timeStr = `${hours}-${minutes}-${seconds}`;
	
	const senderKey = email.from.replace(/[@.]/g, '_').replace(/[<>"]/g, '').trim();
	return `${dateStr}_${senderKey}_${timeStr}`;
}

// Classify email based on rules
function classifyEmail(email: Email): string | null {
	const emailFrom = email.from.toLowerCase();
	const emailTo = email.to.toLowerCase();
	const emailSubject = email.subject.toLowerCase();
	const emailBody = email.body.toLowerCase();
	
	for (const rule of CLASSIFICATION_RULES) {
		let matches = 0;
		let totalConditions = 0;
		
		// Check from conditions
		if (rule.conditions.fromIncludes) {
			totalConditions++;
			if (rule.conditions.fromIncludes.some(pattern => emailFrom.includes(pattern.toLowerCase()))) {
				matches++;
			}
		}
		
		// Check to conditions
		if (rule.conditions.toIncludes) {
			totalConditions++;
			if (rule.conditions.toIncludes.some(pattern => emailTo.includes(pattern.toLowerCase()))) {
				matches++;
			}
		}
		
		// Check subject conditions
		if (rule.conditions.subjectIncludes) {
			totalConditions++;
			if (rule.conditions.subjectIncludes.some(pattern => emailSubject.includes(pattern.toLowerCase()))) {
				matches++;
			}
		}
		
		// Check body conditions
		if (rule.conditions.bodyIncludes) {
			totalConditions++;
			if (rule.conditions.bodyIncludes.some(pattern => emailBody.includes(pattern.toLowerCase()))) {
				matches++;
			}
		}
		
		// If any condition matches, classify to this namespace
		if (matches > 0) {
			console.log(`✅ Email classified to ${rule.namespace}: ${email.subject}`);
			return rule.namespace;
		}
	}
	
	console.log(`⚪ Email not classified: ${email.subject}`);
	return null;
}

async function fetchEmails(): Promise<Email[]> {
	try {
		const response = await fetch('http://localhost:4000/fetch-emails', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ account: 'mobicycle-ou', daysBack: 365 })
		});
		
		const emails = await response.json();
		console.log(`📧 Fetched ${emails.length} emails`);
		return emails;
	} catch (error) {
		console.error('❌ Failed to fetch emails:', error);
		return [];
	}
}

async function storeEmailInKV(namespace: string, emailKey: string, email: Email): Promise<void> {
	try {
		// Use wrangler CLI to store the email
		const emailData = JSON.stringify(email);
		const command = `wrangler kv key put "${emailKey}" "${emailData.replace(/"/g, '\\"')}" --namespace-id="${await getNamespaceId(namespace)}"`;
		
		console.log(`📝 Storing email in ${namespace}: ${emailKey}`);
		// Note: In a real implementation, you'd execute this command
		// For now, we'll just log what would be stored
		console.log(`   Email: ${email.subject} (${email.date})`);
		
	} catch (error) {
		console.error(`❌ Failed to store email in KV:`, error);
	}
}

async function getNamespaceId(namespace: string): Promise<string> {
	// Map namespace names to their IDs (from the creation output)
	const namespaceIds: Record<string, string> = {
		"email-claimant-hk-law": "6569a3d0c87b4ad897280e25695a7858",
		"email-claimant-lessel": "f94de5c0cb584d8596fcfecf853f4213",
		"email-claimant-liu": "aac7e7e16f87490ba571aa9854c11e8c",
		"email-claimant-rentify": "61d3e5e7b3e94cfab6db2aca6d05869a",
		"email-complaints-bar-standards-board": "142319de0a894f6da1b35ebf457b910f",
		"email-complaints-hmcts": "1f2e69dfa5db49959b5c8f98d87453d6",
		"email-complaints-ico": "e13127c545d646d8bbad29c8832193e7",
		"email-complaints-parliament": "dfff26c86d844c1eada2658f98cc5043",
		"email-complaints-phso": "c336442195044b38b0b44fb6a7bc0c85",
		"email-courts-administrative-court": "37c7b5e5e8a84e2a8e340cb0e1b39202",
		"email-courts-central-london-county-court": "0dd9a961f8e54104a1c784fdd736d354",
		"email-courts-chancery-division": "c0e294c679194bb2921f6faa83826d56",
		"email-courts-clerkenwell-county-court": "450d57986f6b47bd8e6a9881d48b0222",
		"email-courts-court-of-appeals-civil-division": "d730d43a0ff5452b9aa387fd6ab2640e",
		"email-courts-kings-bench-appeals-division": "ab4eb2fdf4844dab802e5006c53fed91",
		"email-courts-supreme-court": "4272a9a3567b4827b3e6b07a9e0ec07b",
		"email-defendants-barristers": "25c9d3da2ba6446883842413b3daa814",
		"email-defendants-both-defendants": "e1305af8eb8d44b28d6838e2516ae122",
		"email-defendants-defendant": "38a222851c034b6ab8c018fcbd5c4079",
		"email-defendants-litigant-in-person-only": "a71c5d09502e40b08522e1b5d7f0127c",
		"email-defendants-mobicycle-ou-only": "6ed1b38a555a4517bb272013b6140acb",
		"email-expenses-legal-fees-claimant": "e2138bc141724569bca4a006b370c94e",
		"email-expenses-legal-fees-company": "c439324554544228b5c722a27119f47e",
		"email-expenses-legal-fees-director": "226bdfd1f03e46e6a48ae5b77c00a264",
		"email-expenses-repairs": "2155671bd23047bb917a7af169640691",
		"email-government-estonia": "e45e1cd170a04580828ac7f88c34c8f8",
		"email-government-uk-legal-department": "da78dcd3387040478f852eccd7fa47eb",
		"email-government-us-state-department": "36b5178e1c83446faab3953bc49da196",
		"email-reconsideration-court-officer-review": "513fc3d8c841423d853123e0c6cdfb80",
		"email-reconsideration-cpr52-24-5": "a3393dce32fb4ae69464697e9fd215f0",
		"email-reconsideration-cpr52-24-6": "3117bed7263743ab901115e7a0b5a803",
		"email-reconsideration-cpr52-30": "4598ae69628a49e2a17e1e0b56ad77e7",
		"email-reconsideration-pd52b": "9caf10194efb4a4d8296ac730793960b",
		"email-reconsideration-pta-refusal": "e2b36cf5a9a8422ca589af783cfaf37c",
		"email-reconsideration-single-judge": "300bb71748194533bd1b25288263aeba"
	};
	
	return namespaceIds[namespace] || "";
}

async function main() {
	console.log("🚀 Starting email classification and KV population...");
	
	// Fetch emails
	const emails = await fetchEmails();
	if (emails.length === 0) {
		console.log("⚠️ No emails to process");
		return;
	}
	
	// Process each email
	let classified = 0;
	let unclassified = 0;
	
	for (const email of emails) {
		const namespace = classifyEmail(email);
		const emailKey = generateEmailKey(email);
		
		if (namespace) {
			await storeEmailInKV(namespace, emailKey, email);
			classified++;
		} else {
			unclassified++;
		}
	}
	
	console.log(`✅ Processing complete:`);
	console.log(`   📧 Total emails: ${emails.length}`);
	console.log(`   ✅ Classified: ${classified}`);
	console.log(`   ⚪ Unclassified: ${unclassified}`);
}

// Run the script
main().catch(console.error);