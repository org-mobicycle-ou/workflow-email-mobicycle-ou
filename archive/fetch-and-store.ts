#!/usr/bin/env bun
/**
 * fetch-and-store.ts — MobiCycle OÜ
 * -----------------------------------
 * One-shot script: connects to ProtonMail Bridge IMAP, fetches the 500 most
 * recent emails, categorises each one using the whitelist rules, and writes
 * them straight into the correct Cloudflare KV namespaces via the REST API.
 *
 * Usage:
 *   IMAP_PASS=<bridge-password> CF_API_TOKEN=<cloudflare-api-token> bun run fetch-and-store.ts
 *
 * No tunnel, no HTTP backend — just IMAP → KV.
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

// ── Configuration ──────────────────────────────────────────────────────
const IMAP_HOST  = process.env.IMAP_HOST  || '127.0.0.1';
const IMAP_PORT  = parseInt(process.env.IMAP_PORT || '1143', 10);
const IMAP_USER  = process.env.IMAP_USER  || 'rose@mobicycle.ee';
const IMAP_PASS  = process.env.IMAP_PASS  || '';

const CF_ACCOUNT_ID = '2e4a7955aa124c38058cccd43902a8a5';
const CF_API_TOKEN  = process.env.CF_API_TOKEN || '';

const LIMIT = 500;

// ── KV namespace IDs (real, from Cloudflare) ───────────────────────────
const KV_NAMESPACES: Record<string, string> = {
	// Courts
	'EMAIL_COURTS_SUPREME_COURT':                '4272a9a3567b4827b3e6b07a9e0ec07b',
	'EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION': 'd730d43a0ff5452b9aa387fd6ab2640e',
	'EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION': 'ab4eb2fdf4844dab802e5006c53fed91',
	'EMAIL_COURTS_CHANCERY_DIVISION':            'c0e294c679194bb2921f6faa83826d56',
	'EMAIL_COURTS_ADMINISTRATIVE_COURT':         '37c7b5e5e8a84e2a8e340cb0e1b39202',
	'EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT':  '0dd9a961f8e54104a1c784fdd736d354',
	'EMAIL_COURTS_CLERKENWELL_COUNTY_COURT':     '450d57986f6b47bd8e6a9881d48b0222',
	// Complaints
	'EMAIL_COMPLAINTS_ICO':                      'e13127c545d646d8bbad29c8832193e7',
	'EMAIL_COMPLAINTS_PHSO':                     'c336442195044b38b0b44fb6a7bc0c85',
	'EMAIL_COMPLAINTS_PARLIAMENT':               'dfff26c86d844c1eada2658f98cc5043',
	'EMAIL_COMPLAINTS_HMCTS':                    '1f2e69dfa5db49959b5c8f98d87453d6',
	'EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD':      '142319de0a894f6da1b35ebf457b910f',
	// Expenses
	'EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT':        'e2138bc141724569bca4a006b370c94e',
	'EMAIL_EXPENSES_LEGAL_FEES_COMPANY':         'c439324554544228b5c722a27119f47e',
	'EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR':        '226bdfd1f03e46e6a48ae5b77c00a264',
	'EMAIL_EXPENSES_REPAIRS':                    '2155671bd23047bb917a7af169640691',
	// Claimants
	'EMAIL_CLAIMANT_HK_LAW':                     '6569a3d0c87b4ad897280e25695a7858',
	'EMAIL_CLAIMANT_LESSEL':                     'f94de5c0cb584d8596fcfecf853f4213',
	'EMAIL_CLAIMANT_LIU':                        'aac7e7e16f87490ba571aa9854c11e8c',
	'EMAIL_CLAIMANT_RENTIFY':                    '61d3e5e7b3e94cfab6db2aca6d05869a',
	// Defendants
	'EMAIL_DEFENDANTS_DEFENDANT':                '38a222851c034b6ab8c018fcbd5c4079',
	'EMAIL_DEFENDANTS_BOTH_DEFENDANTS':          'e1305af8eb8d44b28d6838e2516ae122',
	'EMAIL_DEFENDANTS_BARRISTERS':               '25c9d3da2ba6446883842413b3daa814',
	'EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY':  'a71c5d09502e40b08522e1b5d7f0127c',
	'EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY':         '6ed1b38a555a4517bb272013b6140acb',
	// Government
	'EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT':      'da78dcd3387040478f852eccd7fa47eb',
	'EMAIL_GOVERNMENT_ESTONIA':                  'e45e1cd170a04580828ac7f88c34c8f8',
	'EMAIL_GOVERNMENT_US_STATE_DEPARTMENT':      '36b5178e1c83446faab3953bc49da196',
	// Reconsideration
	'EMAIL_RECONSIDERATION_SINGLE_JUDGE':        '300bb71748194533bd1b25288263aeba',
	'EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW':'513fc3d8c841423d853123e0c6cdfb80',
	'EMAIL_RECONSIDERATION_PTA_REFUSAL':         'e2b36cf5a9a8422ca589af783cfaf37c',
	'EMAIL_RECONSIDERATION_CPR52_24_5':          'a3393dce32fb4ae69464697e9fd215f0',
	'EMAIL_RECONSIDERATION_CPR52_24_6':          '3117bed7263743ab901115e7a0b5a803',
	'EMAIL_RECONSIDERATION_CPR52_30':            '4598ae69628a49e2a17e1e0b56ad77e7',
	'EMAIL_RECONSIDERATION_PD52B':               '9caf10194efb4a4d8296ac730793960b',
};

// ── Classification rules (same as whitelist-worker.ts) ─────────────────
interface ClassificationRule {
	namespace: string;
	binding: string;
	conditions: {
		fromIncludes?: string[];
		toIncludes?: string[];
		subjectIncludes?: string[];
	};
}

const RULES: ClassificationRule[] = [
	// Complaints
	{ namespace: 'email-complaints-phso', binding: 'EMAIL_COMPLAINTS_PHSO', conditions: { toIncludes: ['ombudsman.org.uk', 'phso.org.uk', 'lgo.org.uk'], subjectIncludes: ['phso', 'ombudsman'] } },
	{ namespace: 'email-complaints-hmcts', binding: 'EMAIL_COMPLAINTS_HMCTS', conditions: { toIncludes: ['hmcts.gov.uk', 'tribunal.gov.uk'], subjectIncludes: ['hmcts', 'tribunal'] } },
	{ namespace: 'email-complaints-parliament', binding: 'EMAIL_COMPLAINTS_PARLIAMENT', conditions: { toIncludes: ['parliament.uk'], subjectIncludes: ['parliament', 'parliamentary', 'member of parliament'] } },
	{ namespace: 'email-complaints-bar-standards-board', binding: 'EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD', conditions: { toIncludes: ['barstandardsboard.org.uk', 'barcouncil.org.uk', 'lawsociety.org.uk', 'sra.org.uk'], subjectIncludes: ['bar standards', 'barrister', 'chambers'] } },
	{ namespace: 'email-complaints-ico', binding: 'EMAIL_COMPLAINTS_ICO', conditions: { toIncludes: ['ico.org.uk'], fromIncludes: ['ico.org.uk'], subjectIncludes: ['ico', 'information commissioner', 'data protection', 'freedom of information', 'foi', 'gdpr'] } },
	// Courts
	{ namespace: 'email-courts-administrative-court', binding: 'EMAIL_COURTS_ADMINISTRATIVE_COURT', conditions: { toIncludes: ['administrativecourt', 'admin.court', 'courts.gov.uk', 'courtservice.gov.uk'], subjectIncludes: ['administrative court', 'judicial review'] } },
	{ namespace: 'email-courts-central-london-county-court', binding: 'EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT', conditions: { toIncludes: ['centrallondon', 'central.london'], subjectIncludes: ['central london county court', 'clcc'] } },
	{ namespace: 'email-courts-chancery-division', binding: 'EMAIL_COURTS_CHANCERY_DIVISION', conditions: { toIncludes: ['chancery'], subjectIncludes: ['chancery division', 'chancery court'] } },
	{ namespace: 'email-courts-supreme-court', binding: 'EMAIL_COURTS_SUPREME_COURT', conditions: { toIncludes: ['supremecourt.uk', 'judiciary.uk'], subjectIncludes: ['supreme court', 'uksc'] } },
	{ namespace: 'email-courts-court-of-appeals-civil-division', binding: 'EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION', conditions: { subjectIncludes: ['court of appeal', 'civil division', 'appeal court'] } },
	{ namespace: 'email-courts-kings-bench-appeals-division', binding: 'EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION', conditions: { subjectIncludes: ["king's bench", 'kings bench', 'kbd'] } },
	{ namespace: 'email-courts-clerkenwell-county-court', binding: 'EMAIL_COURTS_CLERKENWELL_COUNTY_COURT', conditions: { toIncludes: ['clerkenwell'], subjectIncludes: ['clerkenwell'] } },
	// Government
	{ namespace: 'email-government-uk-legal-department', binding: 'EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT', conditions: { toIncludes: ['gov.uk', 'government-legal', 'cabinet-office.gov.uk', 'homeoffice.gov.uk', 'fco.gov.uk', 'justice.gov.uk'], subjectIncludes: ['government legal', 'treasury solicitor'] } },
	{ namespace: 'email-government-us-state-department', binding: 'EMAIL_GOVERNMENT_US_STATE_DEPARTMENT', conditions: { toIncludes: ['state.gov'], subjectIncludes: ['state department', 'embassy', 'consulate'] } },
	{ namespace: 'email-government-estonia', binding: 'EMAIL_GOVERNMENT_ESTONIA', conditions: { toIncludes: ['gov.ee', 'riigikantselei.ee'], subjectIncludes: ['estonia', 'estonian'] } },
	// Claimants
	{ namespace: 'email-claimant-hk-law', binding: 'EMAIL_CLAIMANT_HK_LAW', conditions: { fromIncludes: ['hk-law', 'hongkong'], toIncludes: ['hk-law', 'hongkong'], subjectIncludes: ['hk law', 'hong kong'] } },
	{ namespace: 'email-claimant-lessel', binding: 'EMAIL_CLAIMANT_LESSEL', conditions: { fromIncludes: ['lessel'], toIncludes: ['lessel'], subjectIncludes: ['lessel'] } },
	{ namespace: 'email-claimant-liu', binding: 'EMAIL_CLAIMANT_LIU', conditions: { fromIncludes: ['liu'], toIncludes: ['liu'], subjectIncludes: ['liu'] } },
	{ namespace: 'email-claimant-rentify', binding: 'EMAIL_CLAIMANT_RENTIFY', conditions: { fromIncludes: ['rentify'], toIncludes: ['rentify'], subjectIncludes: ['rentify'] } },
	// Defendants
	{ namespace: 'email-defendants-defendant', binding: 'EMAIL_DEFENDANTS_DEFENDANT', conditions: { subjectIncludes: ['defendant', 'respondent'] } },
	{ namespace: 'email-defendants-both-defendants', binding: 'EMAIL_DEFENDANTS_BOTH_DEFENDANTS', conditions: { subjectIncludes: ['both defendants', 'co-defendant'] } },
	{ namespace: 'email-defendants-barristers', binding: 'EMAIL_DEFENDANTS_BARRISTERS', conditions: { fromIncludes: ['chambers', 'barrister', 'counsel'], subjectIncludes: ['barrister', 'counsel', 'chambers'] } },
	{ namespace: 'email-defendants-litigant-in-person-only', binding: 'EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY', conditions: { subjectIncludes: ['litigant in person', 'lip', 'self-represented'] } },
	{ namespace: 'email-defendants-mobicycle-ou-only', binding: 'EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY', conditions: { toIncludes: ['mobicycle'], fromIncludes: ['mobicycle'], subjectIncludes: ['mobicycle'] } },
	// Reconsideration
	{ namespace: 'email-reconsideration-single-judge', binding: 'EMAIL_RECONSIDERATION_SINGLE_JUDGE', conditions: { subjectIncludes: ['single judge', 'paper determination'] } },
	{ namespace: 'email-reconsideration-court-officer-review', binding: 'EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW', conditions: { subjectIncludes: ['court officer', 'officer review'] } },
	{ namespace: 'email-reconsideration-pta-refusal', binding: 'EMAIL_RECONSIDERATION_PTA_REFUSAL', conditions: { subjectIncludes: ['pta refusal', 'permission to appeal refused', 'permission refused'] } },
	{ namespace: 'email-reconsideration-cpr52-24-5', binding: 'EMAIL_RECONSIDERATION_CPR52_24_5', conditions: { subjectIncludes: ['cpr 52.24(5)', 'cpr52.24(5)', '52.24(5)'] } },
	{ namespace: 'email-reconsideration-cpr52-24-6', binding: 'EMAIL_RECONSIDERATION_CPR52_24_6', conditions: { subjectIncludes: ['cpr 52.24(6)', 'cpr52.24(6)', '52.24(6)'] } },
	{ namespace: 'email-reconsideration-cpr52-30', binding: 'EMAIL_RECONSIDERATION_CPR52_30', conditions: { subjectIncludes: ['cpr 52.30', 'cpr52.30', 'taylor v lawrence'] } },
	{ namespace: 'email-reconsideration-pd52b', binding: 'EMAIL_RECONSIDERATION_PD52B', conditions: { subjectIncludes: ['pd52b', 'pd 52b', 'practice direction 52b'] } },
	// Expenses
	{ namespace: 'email-expenses-legal-fees-claimant', binding: 'EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT', conditions: { subjectIncludes: ['legal fees', 'costs claimant', 'claimant fees'] } },
	{ namespace: 'email-expenses-legal-fees-company', binding: 'EMAIL_EXPENSES_LEGAL_FEES_COMPANY', conditions: { subjectIncludes: ['company fees', 'company costs', 'corporate legal'] } },
	{ namespace: 'email-expenses-legal-fees-director', binding: 'EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR', conditions: { subjectIncludes: ['director fees', 'director costs', 'personal liability'] } },
	{ namespace: 'email-expenses-repairs', binding: 'EMAIL_EXPENSES_REPAIRS', conditions: { subjectIncludes: ['repairs', 'maintenance', 'repair costs'] } },
];

// ── Classify an email → binding name(s) ────────────────────────────────
function classifyEmail(from: string, to: string, subject: string): string[] {
	const f = from.toLowerCase();
	const t = to.toLowerCase();
	const s = subject.toLowerCase();
	const matched: string[] = [];

	for (const rule of RULES) {
		let hit = false;
		if (rule.conditions.fromIncludes?.some(p => f.includes(p.toLowerCase()))) hit = true;
		if (rule.conditions.toIncludes?.some(p => t.includes(p.toLowerCase()) || f.includes(p.toLowerCase()))) hit = true;
		if (rule.conditions.subjectIncludes?.some(p => s.includes(p.toLowerCase()))) hit = true;
		if (hit) matched.push(rule.binding);
	}

	return matched;
}

// ── Generate email key: YYYY.MM.DD_sender@email_HH:MM ─────────────────
function generateEmailKey(from: string, date: Date): string {
	const y = date.getUTCFullYear();
	const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
	const d = date.getUTCDate().toString().padStart(2, '0');
	const h = date.getUTCHours().toString().padStart(2, '0');
	const min = date.getUTCMinutes().toString().padStart(2, '0');
	return `${y}.${m}.${d}_${from}_${h}:${min}`;
}

// ── Write a single key to Cloudflare KV via REST API ───────────────────
async function kvPut(namespaceId: string, key: string, value: string): Promise<boolean> {
	const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
	const res = await fetch(url, {
		method: 'PUT',
		headers: {
			'Authorization': `Bearer ${CF_API_TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: value,
	});
	return res.ok;
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
	// Validate env
	if (!IMAP_PASS) { console.error('Set IMAP_PASS (ProtonMail Bridge password)'); process.exit(1); }
	if (!CF_API_TOKEN) { console.error('Set CF_API_TOKEN (Cloudflare API token with KV write permission)'); process.exit(1); }

	console.log(`\n  MobiCycle OÜ — fetch-and-store`);
	console.log(`  IMAP: ${IMAP_USER}@${IMAP_HOST}:${IMAP_PORT}`);
	console.log(`  Fetching last ${LIMIT} emails → Cloudflare KV\n`);

	// 1. Connect to ProtonMail Bridge
	const client = new ImapFlow({
		host: IMAP_HOST,
		port: IMAP_PORT,
		secure: false,
		auth: { user: IMAP_USER, pass: IMAP_PASS },
		tls: { rejectUnauthorized: false },
		logger: false,
	});

	await client.connect();
	console.log('[IMAP] Connected to ProtonMail Bridge');

	const mailbox = await client.mailboxOpen('INBOX');
	console.log(`[IMAP] INBOX: ${mailbox.exists} messages total`);

	// 2. Fetch the 500 most recent messages (all, not just unseen)
	const allUids = await client.search({});
	const recentUids = allUids.slice(-LIMIT);
	console.log(`[IMAP] Fetching ${recentUids.length} most recent messages...\n`);

	let stored = 0;
	let skipped = 0;
	let unmatched = 0;
	const unmatchedSenders: string[] = [];

	for (let i = 0; i < recentUids.length; i++) {
		const uid = recentUids[i];
		try {
			const msg = await client.fetchOne(uid, { source: true, uid: true });
			if (!msg.source) continue;

			const parsed = await simpleParser(msg.source);
			const from = parsed.from?.value?.[0]?.address || 'unknown';
			const to   = parsed.to?.value?.[0]?.address || '';
			const subject = parsed.subject || '(No Subject)';
			const date = parsed.date || new Date();
			const body = parsed.text || parsed.html || '';
			const messageId = parsed.messageId || `<${uid}@protonmail.bridge>`;

			// Skip emails FROM rose@mobicycle.ee
			if (from.toLowerCase().includes('rose@mobicycle.ee')) {
				skipped++;
				continue;
			}

			// Classify
			const bindings = classifyEmail(from, to, subject);

			if (bindings.length === 0) {
				unmatched++;
				if (!unmatchedSenders.includes(from)) unmatchedSenders.push(from);
				continue;
			}

			// Generate key
			const key = generateEmailKey(from, date);

			// Build value
			const value = JSON.stringify({
				id: `${uid}`,
				key,
				from,
				to,
				subject,
				body,
				date: date.toISOString(),
				messageId,
				storedAt: new Date().toISOString(),
			});

			// Write to each matched KV namespace
			for (const binding of bindings) {
				const nsId = KV_NAMESPACES[binding];
				if (!nsId) {
					console.warn(`  No namespace ID for binding ${binding}`);
					continue;
				}
				const ok = await kvPut(nsId, key, value);
				if (ok) {
					stored++;
					if ((i + 1) % 25 === 0 || i === recentUids.length - 1) {
						process.stdout.write(`\r  Progress: ${i + 1}/${recentUids.length} emails processed, ${stored} stored`);
					}
				} else {
					console.warn(`\n  Failed to write ${key} to ${binding}`);
				}
			}
		} catch (err: any) {
			console.warn(`\n  Error on UID ${uid}: ${err.message}`);
		}
	}

	await client.logout();

	console.log(`\n\n  Done.`);
	console.log(`  Stored:    ${stored} key-value pairs across ${Object.keys(KV_NAMESPACES).length} namespaces`);
	console.log(`  Skipped:   ${skipped} (sent by rose@mobicycle.ee)`);
	console.log(`  Unmatched: ${unmatched} (no whitelist rule matched)`);
	if (unmatchedSenders.length > 0) {
		console.log(`\n  Unmatched senders (consider adding rules):`);
		for (const s of unmatchedSenders.slice(0, 20)) {
			console.log(`    - ${s}`);
		}
		if (unmatchedSenders.length > 20) {
			console.log(`    ... and ${unmatchedSenders.length - 20} more`);
		}
	}
}

main().catch(err => {
	console.error('Fatal error:', err);
	process.exit(1);
});
