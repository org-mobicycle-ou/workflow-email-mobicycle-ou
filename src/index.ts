/**
 * Email Triage Workflow - Unified Workflow (NOT separate workers)
 * All email processing logic in ONE workflow with steps
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

interface Env {
	// Workflow binding
	EMAIL_TRIAGE: Workflow;

	// Variables
	TUNNEL_URL: string;
	PROTON_EMAIL: string;

	// All KV namespaces
	EMAIL_COURTS_SUPREME_COURT: KVNamespace;
	EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION: KVNamespace;
	EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION: KVNamespace;
	EMAIL_COURTS_CHANCERY_DIVISION: KVNamespace;
	EMAIL_COURTS_ADMINISTRATIVE_COURT: KVNamespace;
	EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT: KVNamespace;
	EMAIL_COURTS_CLERKENWELL_COUNTY_COURT: KVNamespace;
	EMAIL_COMPLAINTS_ICO: KVNamespace;
	EMAIL_COMPLAINTS_PHSO: KVNamespace;
	EMAIL_COMPLAINTS_PARLIAMENT: KVNamespace;
	EMAIL_COMPLAINTS_HMCTS: KVNamespace;
	EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD: KVNamespace;
	EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT: KVNamespace;
	EMAIL_EXPENSES_LEGAL_FEES_COMPANY: KVNamespace;
	EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR: KVNamespace;
	EMAIL_EXPENSES_REPAIRS: KVNamespace;
	EMAIL_CLAIMANT_HK_LAW: KVNamespace;
	EMAIL_CLAIMANT_LESSEL: KVNamespace;
	EMAIL_CLAIMANT_LIU: KVNamespace;
	EMAIL_CLAIMANT_RENTIFY: KVNamespace;
	EMAIL_DEFENDANTS_DEFENDANT: KVNamespace;
	EMAIL_DEFENDANTS_BOTH_DEFENDANTS: KVNamespace;
	EMAIL_DEFENDANTS_BARRISTERS: KVNamespace;
	EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY: KVNamespace;
	EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY: KVNamespace;
	EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT: KVNamespace;
	EMAIL_GOVERNMENT_ESTONIA: KVNamespace;
	EMAIL_GOVERNMENT_US_STATE_DEPARTMENT: KVNamespace;
	EMAIL_RECONSIDERATION_SINGLE_JUDGE: KVNamespace;
	EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW: KVNamespace;
	EMAIL_RECONSIDERATION_CPR52_24_5: KVNamespace;
	EMAIL_RECONSIDERATION_CPR52_24_6: KVNamespace;
	EMAIL_RECONSIDERATION_CPR52_30: KVNamespace;
	EMAIL_RECONSIDERATION_PD52B: KVNamespace;
	EMAIL_RECONSIDERATION_PTA_REFUSAL: KVNamespace;
}

interface Email {
	id: string;
	from: string;
	to: string;
	subject: string;
	body: string;
	date: string;
	messageId: string;
}

interface EmailTriageParams {
	batchId?: string;
	timestamp?: string;
}

export class EmailTriageWorkflow extends WorkflowEntrypoint<Env, EmailTriageParams> {

	async run(event: WorkflowEvent<EmailTriageParams>, step: WorkflowStep) {

		// Step 1: Connect to Protonmail Bridge via tunnel
		const connection = await step.do('connect-protonmail-bridge', async () => {
			const tunnelUrl = this.env.TUNNEL_URL || 'https://imap.mobicycle.ee';
			console.log(`Connecting to Protonmail Bridge at ${tunnelUrl}`);

			const healthCheck = await fetch(`${tunnelUrl}/health`);
			if (!healthCheck.ok) {
				throw new Error(`Protonmail Bridge connection failed: ${healthCheck.status}`);
			}

			const health = await healthCheck.json();
			return { tunnelUrl, connected: true, email: health.config?.email };
		});

		// Step 2: Retrieve emails from Protonmail
		const emails = await step.do('retrieve-emails',
			{ retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' } },
			async () => {
				const response = await fetch(`${connection.tunnelUrl}/fetch-emails`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						account: this.env.PROTON_EMAIL,
						folder: 'INBOX',
						limit: 50,
						unseenOnly: false
					})
				});

				if (!response.ok) {
					throw new Error(`Failed to fetch emails: ${response.status}`);
				}

				const data = await response.json();
				return data.emails || [];
			}
		);

		console.log(`Retrieved ${emails.length} emails`);

		// Step 3: Check whitelist and filter relevant emails
		const relevantEmails = await step.do('filter-whitelist', async () => {
			// Load whitelist (in production, this would be from KV or database)
			// For now, accept all emails from known domains
			const allowedDomains = [
				'.court', '.gov.uk', '.ee', '@ico.org.uk',
				'@ombudsman.org.uk', '@parliament.uk'
			];

			return emails.filter((email: Email) => {
				return allowedDomains.some(domain => email.from.includes(domain));
			});
		});

		console.log(`${relevantEmails.length} emails passed whitelist`);

		// Step 4: Distribute emails to appropriate KV namespaces
		const distributed = await step.do('distribute-to-kv', async () => {
			const results = [];

			for (const email of relevantEmails) {
				// Determine KV namespace based on sender domain
				const kvNamespace = this.getKVNamespaceForEmail(email.from);

				if (kvNamespace) {
					// Generate unique key for email
					const emailKey = this.generateEmailKey(email);

					// Store email in KV
					await kvNamespace.put(emailKey, JSON.stringify(email));

					results.push({
						emailId: email.id,
						from: email.from,
						kvKey: emailKey,
						stored: true
					});
				}
			}

			return results;
		});

		console.log(`Distributed ${distributed.length} emails to KV namespaces`);

		// Step 5: Process each email (triage, classify, etc.)
		for (const result of distributed) {
			const emailId = result.emailId;

			await step.do(`process-${emailId}`, async () => {
				console.log(`Processing email ${emailId}`);
				// Add email processing logic here
				// (classification, case linking, etc.)
				return { processed: true, emailId };
			});
		}

		// Step 6: Log workflow completion
		await step.do('log-completion', async () => {
			return {
				workflowId: event.instanceId,
				completed: new Date().toISOString(),
				emailsRetrieved: emails.length,
				emailsProcessed: distributed.length
			};
		});

		return {
			success: true,
			emailsProcessed: distributed.length
		};
	}

	// Helper: Get KV namespace for email address
	private getKVNamespaceForEmail(emailAddress: string): KVNamespace | null {
		const email = emailAddress.toLowerCase();

		// Courts
		if (email.includes('supremecourt') || email.includes('uksc')) {
			return this.env.EMAIL_COURTS_SUPREME_COURT;
		}
		if (email.includes('admin.court') || email.includes('administrativecourt')) {
			return this.env.EMAIL_COURTS_ADMINISTRATIVE_COURT;
		}
		if (email.includes('chancerydivision')) {
			return this.env.EMAIL_COURTS_CHANCERY_DIVISION;
		}

		// Complaints
		if (email.includes('ico.org.uk')) {
			return this.env.EMAIL_COMPLAINTS_ICO;
		}
		if (email.includes('ombudsman.org.uk')) {
			return this.env.EMAIL_COMPLAINTS_PHSO;
		}
		if (email.includes('parliament.uk')) {
			return this.env.EMAIL_COMPLAINTS_PARLIAMENT;
		}

		// Government
		if (email.includes('.ee') && email.includes('gov')) {
			return this.env.EMAIL_GOVERNMENT_ESTONIA;
		}
		if (email.includes('gov.uk') && email.includes('legal')) {
			return this.env.EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT;
		}

		// Default: use a general namespace if available
		return null;
	}

	// Helper: Generate unique email key
	private generateEmailKey(email: Email): string {
		const emailDate = new Date(email.date);
		const year = emailDate.getUTCFullYear();
		const month = (emailDate.getUTCMonth() + 1).toString().padStart(2, '0');
		const day = emailDate.getUTCDate().toString().padStart(2, '0');
		const dateStr = `${year}.${month}.${day}`;
		const hours = emailDate.getUTCHours().toString().padStart(2, '0');
		const minutes = emailDate.getUTCMinutes().toString().padStart(2, '0');
		const senderKey = email.from.replace(/[^a-zA-Z0-9@._-]/g, '_');

		return `${dateStr}_${senderKey}_${hours}:${minutes}`;
	}
}

// Export handler to trigger workflow
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		// Create workflow instance
		const instance = await env.EMAIL_TRIAGE.create({
			params: {
				batchId: crypto.randomUUID(),
				timestamp: new Date().toISOString()
			}
		});

		return new Response(JSON.stringify({
			workflowId: instance.id,
			status: 'started',
			message: 'Email triage workflow started'
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
