/**
 * Email Triage Workflow - MobiCycle Account
 * -----------------------------------------
 * Legal case management system for rose@mobicycle.ee
 * 
 * CRITICAL: This is ONLY for the MobiCycle account
 * DO NOT deploy to other accounts - legal privilege at risk
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep, DurableObject, DurableObjectState } from 'cloudflare:workers';
import { isEmailWhitelisted, getKVNamespaceForEmail } from './whitelist-worker';

export interface EmailTriageParams {
	batchId: string;
	timestamp: string;
}

export interface Email {
	id: string;
	from: string;
	to: string;
	subject: string;
	body: string;
	date: string;
	messageId: string;
}

export interface CaseContext {
	keywords: string[];
	addresses: string[];
	caseNumbers: string[];
	relatedEmails: Email[];
}

export interface TriageClassification {
	level: 'no-action' | 'low-complexity' | 'high-complexity';
	reasoning: string;
	confidence: number;
}

export class EmailTriageWorkflow extends WorkflowEntrypoint {
	// Helper function to generate consistent email keys with proper format
	private async generateEmailKey(email: Email, kvNamespace: any): Promise<string> {
		const emailDate = new Date(email.date);
		const year = emailDate.getUTCFullYear();
		const month = (emailDate.getUTCMonth() + 1).toString().padStart(2, '0');
		const day = emailDate.getUTCDate().toString().padStart(2, '0');
		const dateStr = `${year}.${month}.${day}`; // Corrected format: YYYY.MM.DD
		const hours = emailDate.getUTCHours().toString().padStart(2, '0');
		const minutes = emailDate.getUTCMinutes().toString().padStart(2, '0');
		const senderKey = email.from; // Keep @ symbol as requested
		
		// Try without seconds first
		const baseKey = `${dateStr}_${senderKey}_${hours}:${minutes}`;
		const existing = await kvNamespace.get(baseKey);
		
		if (!existing) {
			return baseKey;
		}
		
		// If duplicate, add seconds
		const seconds = emailDate.getUTCSeconds().toString().padStart(2, '0');
		return `${dateStr}_${senderKey}_${hours}:${minutes}:${seconds}`;
	}
	
	// Helper function to update email status in the email's own KV namespace
	private async updateEmailStatus(email: Email, stage: string, additionalData: any = {}, kvNamespace?: any) {
		// Use provided KV namespace, or look up the correct one for this email
		const targetKV = kvNamespace || this.getKVNamespaceForEmail(email.from);
		if (!targetKV) {
			console.warn(`[STATUS] No KV namespace found for ${email.from}, status update skipped`);
			return `no-kv-${email.id}`;
		}

		const emailKey = await this.generateEmailKey(email, targetKV);
		const statusKey = `status-${emailKey}`;

		const statusData = {
			stage,
			emailKey,
			from: email.from,
			subject: email.subject,
			updatedAt: new Date().toISOString(),
			...additionalData
		};

		await targetKV.put(statusKey, JSON.stringify(statusData));
		return emailKey;
	}

	// Resolve KV namespace binding for an email address
	private getKVNamespaceForEmail(emailAddress: string): any | null {
		const namespaceName = getKVNamespaceForEmail(emailAddress);
		if (!namespaceName || namespaceName === 'UNCLASSIFIED') return null;
		return this.env[namespaceName] || null;
	}

	async run(event: WorkflowEvent<EmailTriageParams>, step: WorkflowStep) {
		const { batchId, timestamp } = event.payload;
		
		console.log(`[MOBICYCLE] Starting 21-step email triage workflow: ${batchId}`);
		
		try {
			// PHASE 1: EMAIL COLLECTION & FILTERING (Steps 1-5)
			
			// Step 1: ProtonMail Bridge fetches unseen emails
			const allEmails = await step.do('step-1-fetch-unseen-emails', async () => {
				console.log('[STEP 1] Fetching unseen emails from ProtonMail Bridge...');
				const response = await fetch('https://imap.mobicycle.ee/fetch-emails', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						account: 'rose@mobicycle.ee',
						unseenOnly: true
					})
				});
				if (!response.ok) {
					throw new Error(`Failed to fetch emails: ${response.status}`);
				}
				const emails = await response.json() as Email[];
				console.log(`[STEP 1] Fetched ${emails.length} unseen emails from ProtonMail`);
				return emails;
			});
			
			// Step 2: Filter for relevant emails using whitelist
			const relevantEmails = await step.do('step-2-filter-relevant-emails', async () => {
				console.log('[STEP 2] Filtering emails using whitelist...');
				const filtered = allEmails.filter(email => {
					return isEmailWhitelisted(email.from);
				});
				console.log(`[STEP 2] ${filtered.length} of ${allEmails.length} emails passed whitelist filter`);
				return filtered;
			});
			
			// Step 3: Remove emails where rose@mobicycle.ee is sender
			const filteredEmails = await step.do('step-3-remove-rose-emails', async () => {
				console.log('[STEP 3] Removing emails sent by rose@mobicycle.ee...');
				const filtered = relevantEmails.filter(email => 
					!email.from.toLowerCase().includes('rose@mobicycle.ee')
				);
				console.log(`[STEP 3] ${filtered.length} emails remaining after removing Rose's sent emails`);
				return filtered;
			});
			
			// Step 4: Update todo list with new emails
			const todoList = await step.do('step-4-update-todo-list', async () => {
				console.log('[STEP 4] Updating todo list with new emails...');
				const todoData = {
					batchId,
					timestamp: new Date().toISOString(),
					emailCount: filteredEmails.length,
					emails: filteredEmails.map(email => ({
						from: email.from,
						subject: email.subject,
						date: email.date,
						status: 'pending'
					})),
					processingStatus: 'todo-created'
				};
				// Todo list is passed between workflow steps — no KV storage needed
				console.log(`[STEP 4] Todo list created with ${filteredEmails.length} emails`);
				return todoData;
			});
			
			// Step 5: Send notifications to Claude & Rose
			const notifications = await step.do('step-5-send-notifications', async () => {
				console.log('[STEP 5] Sending notifications to Claude & Rose...');
				const notificationPromises = [
					// Notify Claude
					fetch('https://claude-webhook.mobicycle.ee/notify-claude', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							type: 'new-emails-for-triage',
							count: filteredEmails.length,
							batchId,
							timestamp: new Date().toISOString()
						})
					}),
					// Notify Rose
					fetch('https://claude-webhook.mobicycle.ee/notify-rose', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							type: 'new-legal-emails',
							count: filteredEmails.length,
							batchId,
							emails: filteredEmails.slice(0, 5).map(e => ({ from: e.from, subject: e.subject }))
						})
					})
				];
				const results = await Promise.allSettled(notificationPromises);
				console.log(`[STEP 5] Notifications sent: ${results.filter(r => r.status === 'fulfilled').length}/2 successful`);
				return results;
			});
			
			if (filteredEmails.length === 0) {
				console.log('[MOBICYCLE] No emails to process after filtering');
				return { status: 'no-emails-to-process', batchId, timestamp };
			}
			
			// PHASE 2: EMAIL TRIAGE (Steps 6-11)
			
			// Step 6: Shortlist one email for processing
			const shortlistedEmail = await step.do('step-6-shortlist-email', async () => {
				console.log('[STEP 6] Shortlisting one email for processing...');
				// Sort by date (most recent first) and take the first one
				const sortedEmails = filteredEmails.sort((a, b) => 
					new Date(b.date).getTime() - new Date(a.date).getTime()
				);
				const selected = sortedEmails[0];
				console.log(`[STEP 6] Selected email from ${selected.from}: "${selected.subject}"`);
				return selected;
			});
			
			// Step 7: Extract keywords from email content
			const keywords = await step.do('step-7-extract-keywords', async () => {
				console.log('[STEP 7] Extracting keywords from email content...');
				const extracted = this.extractLegalKeywords(shortlistedEmail.body);
				console.log(`[STEP 7] Extracted ${extracted.length} keywords: ${extracted.slice(0, 5).join(', ')}...`);
				return extracted;
			});
			
			// Step 8: Extract email addresses from email
			const emailAddresses = await step.do('step-8-extract-email-addresses', async () => {
				console.log('[STEP 8] Extracting email addresses...');
				const extracted = this.extractLegalAddresses(shortlistedEmail);
				console.log(`[STEP 8] Extracted ${extracted.length} email addresses`);
				return extracted;
			});
			
			// Step 9: Extract references (case numbers, etc.)
			const caseReferences = await step.do('step-9-extract-references', async () => {
				console.log('[STEP 9] Extracting case references and numbers...');
				const extracted = this.extractCaseNumbers(shortlistedEmail.body);
				console.log(`[STEP 9] Extracted ${extracted.length} case references`);
				return extracted;
			});
			
			// Step 10: Find related emails by context
			const relatedEmails = await step.do('step-10-find-related-emails', async () => {
				console.log('[STEP 10] Finding related emails by context...');
				const related = this.findRelatedLegalEmails(shortlistedEmail, filteredEmails);
				console.log(`[STEP 10] Found ${related.length} related emails`);
				return related;
			});
			
			// Step 11: Send shortlisted email + context to triage worker
			const triageContext = await step.do('step-11-send-to-triage', async () => {
				console.log('[STEP 11] Sending email and context to triage MCP server/worker...');
				const context: CaseContext = {
					keywords,
					addresses: emailAddresses,
					caseNumbers: caseReferences,
					relatedEmails
				};
				
				// Context is passed directly to the next step — no separate KV storage needed
				console.log(`[STEP 11] Triage context prepared with ${context.keywords.length} keywords, ${context.caseNumbers.length} case refs`);
				return context;
			});
			
			// PHASE 3: CLASSIFICATION & ACTION (Steps 12-15)
			
			// Step 12: Triage classifies as: (1) No action (2) Low complexity (3) High complexity
			const classification = await step.do('step-12-classify-email', {
				retries: { 
					limit: 3,
					delay: '30s',
					backoff: 'exponential'
				}
			}, async () => {
				console.log('[STEP 12] Classifying email complexity...');
				const result = await this.classifyLegalComplexity(shortlistedEmail, triageContext);
				console.log(`[STEP 12] Classification: ${result.level} (confidence: ${result.confidence})`);
				return result;
			});
			
			// Steps 13-15: Handle based on classification
			switch (classification.level) {
				case 'no-action':
					// Step 13: No action → mark todo as closed
					const noActionResult = await step.do('step-13-close-no-action', async () => {
						console.log('[STEP 13] No action required - closing todo...');
						await this.updateEmailStatus(shortlistedEmail, 'completed-no-action', {
							classification,
							completedAt: new Date().toISOString()
						});
						console.log('[STEP 13] Todo marked as closed - no action needed');
						return { status: 'closed-no-action', emailId: shortlistedEmail.id, classification };
					});
					return { ...noActionResult, batchId, timestamp };
					
				case 'low-complexity':
					// Step 14: Low complexity → Claude responds → mark closed
					const lowComplexityResult = await step.do('step-14-handle-low-complexity', {
						retries: { limit: 2, delay: '10s' }
					}, async () => {
						console.log('[STEP 14] Handling low complexity email - generating response...');
						
						// Generate response using Claude
						const response = await this.generateLegalResponse(shortlistedEmail, triageContext);
						
						// Send response
						await fetch('https://imap.mobicycle.ee/send-email', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								from: 'rose@mobicycle.ee',
								to: shortlistedEmail.from,
								subject: `Re: ${shortlistedEmail.subject}`,
								text: response,
								references: shortlistedEmail.messageId
							})
						});
						
						// Mark as completed
						await this.updateEmailStatus(shortlistedEmail, 'completed-low-complexity', {
							classification,
							response: response.substring(0, 200) + '...',
							completedAt: new Date().toISOString()
						});
						
						console.log('[STEP 14] Low complexity email handled and closed');
						return { status: 'completed-low-complexity', emailId: shortlistedEmail.id, responseSent: true };
					});
					return { ...lowComplexityResult, batchId, timestamp };
					
				case 'high-complexity':
					// Step 15: High complexity → Claude creates documents/submits applications
					const highComplexityResult = await step.do('step-15-handle-high-complexity', async () => {
						console.log('[STEP 15] Handling high complexity email - initiating document creation...');
						
						// Mark as in progress for document generation phase
						await this.updateEmailStatus(shortlistedEmail, 'high-complexity-processing', {
							classification,
							startedAt: new Date().toISOString(),
							nextPhase: 'document-generation'
						});
						
						console.log('[STEP 15] High complexity processing initiated');
						return { status: 'high-complexity-initiated', emailId: shortlistedEmail.id, nextPhase: 'document-generation' };
					});
					
					// Continue to Phase 4 for document generation
					break;
					
				default:
					throw new Error(`Unknown classification: ${classification.level}`);
			}
			
			// PHASE 4: DOCUMENT GENERATION & DELIVERY (Steps 16-21) - Only for high complexity
			if (classification.level === 'high-complexity') {
				
				// Step 16: Claude writes attachments (letters, PDFs)
				const documents = await step.do('step-16-write-attachments', {
					retries: {
						limit: 5,
						delay: '60s',
						backoff: 'exponential'
					}
				}, async () => {
					console.log('[STEP 16] Generating legal documents and attachments...');
					const generated = await this.generateLegalDocuments(shortlistedEmail, triageContext);
					console.log(`[STEP 16] Generated ${generated.length} legal documents`);
					return generated;
				});
				
				// Step 17: Claude formats documents properly
				const formattedDocuments = await step.do('step-17-format-documents', async () => {
					console.log('[STEP 17] Formatting documents properly...');
					const formatted = await this.formatLegalDocuments(documents);
					console.log(`[STEP 17] Formatted ${formatted.length} documents`);
					return formatted;
				});
				
				// Step 18: Claude writes email cover letters
				const coverLetters = await step.do('step-18-write-cover-letters', async () => {
					console.log('[STEP 18] Writing email cover letters...');
					const letters = await this.writeCoverLetters(shortlistedEmail, formattedDocuments, triageContext);
					console.log(`[STEP 18] Written ${letters.length} cover letters`);
					return letters;
				});
				
				// Step 19: Send attachments + cover letters to relevant parties
				const deliveryResults = await step.do('step-19-send-attachments', {
					retries: { limit: 3, delay: '30s' }
				}, async () => {
					console.log('[STEP 19] Sending attachments and cover letters...');
					const results = await this.sendDocumentsToParties(formattedDocuments, coverLetters, triageContext);
					console.log(`[STEP 19] Sent documents to ${results.length} parties`);
					return results;
				});
				
				// Step 20: Upload attachments to ce-file system
				const ceFileResults = await step.do('step-20-upload-to-ce-file', {
					retries: { limit: 5, delay: '30s' }
				}, async () => {
					console.log('[STEP 20] Uploading attachments to ce-file system...');
					await this.uploadToCeFile(formattedDocuments, shortlistedEmail, triageContext);
					console.log('[STEP 20] Documents uploaded to ce-file system');
					return { status: 'uploaded', documentCount: formattedDocuments.length };
				});
				
				// Step 21: Document everything in ce-file with explanations
				const finalDocumentation = await step.do('step-21-document-in-ce-file', async () => {
					console.log('[STEP 21] Creating final documentation in ce-file with explanations...');
					const documentation = await this.createCaseDocumentation(shortlistedEmail, triageContext, formattedDocuments, deliveryResults);
					
					// Mark case as fully completed
					await this.updateEmailStatus(shortlistedEmail, 'completed-high-complexity', {
						classification,
						documentsGenerated: formattedDocuments.length,
						partiesNotified: deliveryResults.length,
						ceFileDocumentation: documentation.documentationId,
						completedAt: new Date().toISOString()
					});
					
					console.log('[STEP 21] All 21 steps completed for high complexity case');
					return documentation;
				});
				
				return {
					status: 'completed-high-complexity-full-workflow',
					emailId: shortlistedEmail.id,
					batchId,
					timestamp,
					documentsGenerated: formattedDocuments.length,
					partiesNotified: deliveryResults.length,
					ceFileResults,
					finalDocumentation
				};
			}
			
			// Store emails in appropriate KV namespaces
			await step.do('store-processed-emails-in-kv', async () => {
				console.log('Storing processed emails in appropriate KV namespaces...');
				
				// Store each email in its appropriate KV namespace
				const emailPromises = filteredEmails.map(async (email) => {
					// Determine the correct KV namespace for this email
					const kvNamespaceName = getKVNamespaceForEmail(email.from);
					const kvNamespace = this.env[kvNamespaceName];
					
					if (!kvNamespace) {
						console.warn(`KV namespace ${kvNamespaceName} not found for email from ${email.from}`);
						return;
					}
					
					const emailKey = await this.generateEmailKey(email, kvNamespace);
					
					// Create email metadata
					const emailMetadata = {
						originalId: email.id,
						key: emailKey,
						from: email.from,
						to: email.to,
						subject: email.subject,
						body: email.body,
						date: email.date,
						messageId: email.messageId,
						kvNamespace: kvNamespaceName,
						storedAt: new Date().toISOString(),
						processingStatus: classification ? 'classified' : 'stored'
					};
					
					// Store email in the correct KV namespace
					await kvNamespace.put(
						emailKey,
						JSON.stringify(emailMetadata)
					);
					console.log(`Stored email ${emailKey} in ${kvNamespaceName}`);
				});
				
				await Promise.all(emailPromises);
				console.log(`Stored ${filteredEmails.length} emails in their respective KV namespaces`);
			});
			
			console.log(`[MOBICYCLE] 21-step workflow completed successfully for batch ${batchId}`);
			return {
				status: 'workflow-completed',
				batchId,
				timestamp,
				totalSteps: 21,
				emailsProcessed: filteredEmails.length,
				shortlistedEmail: shortlistedEmail?.id,
				classification: classification?.level
			};
			
		} catch (error) {
			console.error(`[MOBICYCLE] Workflow failed for batch ${batchId}:`, error);
			// Errors are logged and re-thrown for the Workflows runtime to handle retries
			throw error;
		}
	}
	
	
	
	// Legal-specific methods for MobiCycle account
	private async extractLegalContext(email: Email, allEmails: Email[]): Promise<CaseContext> {
		// Extract legal keywords, case numbers, court references
		const legalKeywords = this.extractLegalKeywords(email.body);
		const caseNumbers = this.extractCaseNumbers(email.body);
		const legalAddresses = this.extractLegalAddresses(email);
		const relatedEmails = this.findRelatedLegalEmails(email, allEmails);
		
		return {
			keywords: legalKeywords,
			addresses: legalAddresses,
			caseNumbers,
			relatedEmails
		};
	}
	
	private extractLegalKeywords(body: string): string[] {
		const legalTerms = [
			// Court proceedings
			'court', 'hearing', 'judgment', 'subpoena', 'discovery',
			'deposition', 'motion', 'brief', 'appeal', 'settlement',
			'trial', 'verdict', 'tribunal', 'injunction', 'restraining order',
			
			// Legal parties
			'plaintiff', 'defendant', 'counsel', 'attorney', 'solicitor',
			'barrister', 'legal representation', 'law firm', 'client',
			
			// Legal documents and processes
			'case', 'docket', 'filing', 'statute', 'regulation', 'compliance',
			'contract', 'agreement', 'lease', 'deed', 'will', 'testament',
			'affidavit', 'declaration', 'evidence', 'testimony',
			
			// Legal actions
			'lawsuit', 'litigation', 'prosecution', 'defense', 'claim',
			'damages', 'liability', 'negligence', 'breach', 'violation',
			'dispute', 'arbitration', 'mediation',
			
			// Legal entities and concepts
			'jurisdiction', 'venue', 'precedent', 'jurisprudence',
			'constitutional', 'statutory', 'common law', 'tort',
			'criminal', 'civil', 'administrative', 'family law'
		];
		
		const foundTerms = legalTerms.filter(term => 
			body.toLowerCase().includes(term.toLowerCase())
		);
		
		// Also extract legal citations (e.g., "Section 123", "Article IV")
		const citationRegex = /(?:section|sec|article|art|rule|reg|chapter|ch|title|tit)\.?\s*\d+/gi;
		const citations = body.match(citationRegex) || [];
		
		return [...foundTerms, ...citations.map(c => c.trim())];
	}
	
	private extractCaseNumbers(body: string): string[] {
		// Multiple patterns for case numbers
		const patterns = [
			// Standard case patterns: "Case No. 123-456", "Docket #789"
			/(?:case|docket|file)\s*(?:no\.?|number|#)\s*:?\s*([a-z0-9\-\/\.]+)/gi,
			
			// Court case formats: "CV-2023-12345", "CR-23-0456"
			/\b(?:cv|cr|civ|crim)-\d{2,4}-\d{3,6}\b/gi,
			
			// Citation formats: "v." indicates case names
			/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+v\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
			
			// Reference numbers in legal docs
			/\b(?:ref|reference|matter)\s*(?:no\.?|number|#)\s*:?\s*([a-z0-9\-\/\.]+)/gi,
			
			// Appeal numbers
			/\b(?:appeal|app)\s*(?:no\.?|number|#)\s*:?\s*([a-z0-9\-\/\.]+)/gi
		];
		
		const caseNumbers: string[] = [];
		
		for (const pattern of patterns) {
			const matches = body.match(pattern);
			if (matches) {
				caseNumbers.push(...matches.map(match => match.trim()));
			}
		}
		
		// Remove duplicates and return
		return [...new Set(caseNumbers)];
	}
	
	private extractLegalAddresses(email: Email): string[] {
		// Extract email addresses and legal entity addresses
		const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
		const emails = email.body.match(emailRegex) || [];
		return [...new Set([email.from, ...emails])];
	}
	
	private findRelatedLegalEmails(email: Email, allEmails: Email[]): Email[] {
		// Find emails with same case numbers, similar subjects, or same parties
		return allEmails.filter(otherEmail => {
			if (otherEmail.id === email.id) return false;
			
			// Check for similar legal subjects
			const subjectSimilarity = this.calculateLegalSubjectSimilarity(
				email.subject, 
				otherEmail.subject
			);
			
			// Check for same sender/recipient
			const sameParties = otherEmail.from === email.from || 
							   otherEmail.to === email.from;
			
			return subjectSimilarity > 0.7 || sameParties;
		});
	}
	
	private calculateLegalSubjectSimilarity(subject1: string, subject2: string): number {
		// Simple similarity based on shared legal keywords
		const legalWords1 = subject1.toLowerCase().split(/\W+/);
		const legalWords2 = subject2.toLowerCase().split(/\W+/);
		
		const intersection = legalWords1.filter(word => 
			legalWords2.includes(word) && word.length > 3
		);
		
		return intersection.length / Math.max(legalWords1.length, legalWords2.length);
	}
	
	private async classifyLegalComplexity(
		email: Email, 
		context: CaseContext
	): Promise<TriageClassification> {
		// Enhanced classification with rule-based pre-filtering
		const preClassification = this.preClassifyLegalEmail(email, context);
		if (preClassification) {
			return preClassification;
		}
		
		// Use AI for complex cases
		const emailSnippet = email.body.substring(0, 1000); // First 1000 chars
		const response = await this.env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
			messages: [{
				role: 'system',
				content: 'You are a legal assistant classifying email complexity for triage. Respond with ONLY the classification level and reasoning.'
			}, {
				role: 'user',
				content: `Classify this legal email's complexity level:

EMAIL DETAILS:
From: ${email.from}
Subject: ${email.subject}
Body (excerpt): ${emailSnippet}

EXTRACTED CONTEXT:
- Legal Keywords Found: ${context.keywords.join(', ') || 'None'}
- Case/Reference Numbers: ${context.caseNumbers.join(', ') || 'None'}
- Related Email Count: ${context.relatedEmails.length}
- Email Addresses: ${context.addresses.slice(0, 3).join(', ')}

CLASSIFICATION CRITERIA:
- NO-ACTION: Automated responses, out-of-office, spam, marketing
- LOW-COMPLEXITY: Simple inquiries, routine correspondence, information requests
- HIGH-COMPLEXITY: Active litigation, court proceedings, complex legal matters, urgent deadlines

Respond in this exact format:
LEVEL: [no-action|low-complexity|high-complexity]
REASONING: [Brief explanation]
CONFIDENCE: [0-100]`
			}]
		});
		
		return this.parseAIClassification(response.response, email, context);
	}
	
	private preClassifyLegalEmail(email: Email, context: CaseContext): TriageClassification | null {
		const subject = email.subject.toLowerCase();
		const body = email.body.toLowerCase();
		const from = email.from.toLowerCase();
		
		// No-action patterns
		const noActionPatterns = [
			'out of office', 'vacation', 'auto-reply', 'automated response',
			'delivery failure', 'undeliverable', 'bounce', 'mailer-daemon',
			'newsletter', 'marketing', 'promotion', 'advertisement'
		];
		
		const isNoAction = noActionPatterns.some(pattern => 
			subject.includes(pattern) || body.includes(pattern)
		);
		
		if (isNoAction) {
			return {
				level: 'no-action',
				reasoning: 'Automated or promotional email detected',
				confidence: 0.95
			};
		}
		
		// High-complexity indicators
		const urgentPatterns = [
			'urgent', 'emergency', 'immediate', 'asap', 'deadline',
			'court date', 'hearing', 'trial', 'subpoena', 'motion due',
			'statute of limitations', 'time sensitive'
		];
		
		const legalComplexityScore = context.keywords.length + 
									 context.caseNumbers.length + 
									 context.relatedEmails.length;
		
		const hasUrgency = urgentPatterns.some(pattern => 
			subject.includes(pattern) || body.includes(pattern)
		);
		
		if (hasUrgency || legalComplexityScore > 5) {
			return {
				level: 'high-complexity',
				reasoning: `High complexity indicators: urgency=${hasUrgency}, complexity_score=${legalComplexityScore}`,
				confidence: 0.85
			};
		}
		
		// If not clearly no-action or high-complexity, let AI decide
		return null;
	}
	
	private parseAIClassification(response: string, email: Email, context: CaseContext): TriageClassification {
		const text = response.toLowerCase();
		
		// Extract level
		let level: TriageClassification['level'] = 'low-complexity'; // default
		if (text.includes('no-action')) {
			level = 'no-action';
		} else if (text.includes('high-complexity')) {
			level = 'high-complexity';
		}
		
		// Extract reasoning
		const reasoningMatch = response.match(/reasoning:\s*(.+?)(?:\n|confidence:|$)/i);
		const reasoning = reasoningMatch ? reasoningMatch[1].trim() : response;
		
		// Extract confidence
		const confidenceMatch = response.match(/confidence:\s*(\d+)/i);
		const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.7;
		
		return {
			level,
			reasoning,
			confidence
		};
	}
	
	private async generateLegalResponse(email: Email, context: CaseContext): Promise<string> {
		const response = await this.env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
			messages: [{
				role: 'user',
				content: `Generate a professional legal response to this email:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.substring(0, 500)}...

Context:
- Legal keywords: ${context.keywords.join(', ')}
- Case numbers: ${context.caseNumbers.join(', ')}

Write a professional response from rose@mobicycle.ee`
			}]
		});
		
		return response.response;
	}
	
	private async generateLegalDocuments(email: Email, context: CaseContext): Promise<any[]> {
		// Generate legal documents based on the case complexity and type
		console.log('Generating legal documents for high complexity case...');
		
		const response = await this.env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
			messages: [{
				role: 'system',
				content: 'You are a legal document generator for MobiCycle OU. Generate appropriate legal documents based on the email and case context.'
			}, {
				role: 'user',
				content: `Generate legal documents for this case:

Email from: ${email.from}
Subject: ${email.subject}
Body: ${email.body.substring(0, 800)}...

Case Context:
- Keywords: ${context.keywords.join(', ')}
- Case Numbers: ${context.caseNumbers.join(', ')}
- Related Emails: ${context.relatedEmails.length}

Generate appropriate legal response documents (letters, applications, filings, etc.)`
			}]
		});
		
		return [{
			type: 'legal-letter',
			filename: `legal-response-${email.id}.pdf`,
			content: response.response,
			generatedAt: new Date().toISOString()
		}];
	}
	
	private async formatLegalDocuments(documents: any[]): Promise<any[]> {
		// Format documents for legal standards (letterhead, formatting, etc.)
		console.log('Formatting legal documents to professional standards...');
		
		return documents.map(doc => ({
			...doc,
			formatted: true,
			header: 'MobiCycle OÜ\nLegal Department\nrose@mobicycle.ee',
			footer: `Generated on ${new Date().toLocaleDateString()} | Confidential Legal Communication`,
			formattedAt: new Date().toISOString()
		}));
	}
	
	private async writeCoverLetters(email: Email, documents: any[], context: CaseContext): Promise<any[]> {
		// Write professional cover letters for each document
		console.log('Writing cover letters for legal documents...');
		
		const response = await this.env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
			messages: [{
				role: 'user',
				content: `Write a professional legal cover letter for sending ${documents.length} document(s) regarding:

Original email from: ${email.from}
Subject: ${email.subject}
Case context: ${context.keywords.slice(0, 5).join(', ')}

Write from rose@mobicycle.ee as legal counsel.`
			}]
		});
		
		return [{
			type: 'cover-letter',
			recipient: email.from,
			subject: `Re: ${email.subject} - Legal Documentation`,
			content: response.response,
			documents: documents.map(d => d.filename),
			writtenAt: new Date().toISOString()
		}];
	}
	
	private async sendDocumentsToParties(documents: any[], coverLetters: any[], context: CaseContext): Promise<any[]> {
		// Send documents to relevant legal parties
		console.log('Sending legal documents to relevant parties...');
		
		const deliveryResults = [];
		
		for (const letter of coverLetters) {
			try {
				const result = await fetch('https://imap.mobicycle.ee/send-email', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						from: 'rose@mobicycle.ee',
						to: letter.recipient,
						subject: letter.subject,
						text: letter.content,
						attachments: letter.documents // Assume documents are handled by email service
					})
				});
				
				deliveryResults.push({
					recipient: letter.recipient,
					status: result.ok ? 'sent' : 'failed',
					sentAt: new Date().toISOString()
				});
			} catch (error) {
				deliveryResults.push({
					recipient: letter.recipient,
					status: 'error',
					error: error.message,
					attemptedAt: new Date().toISOString()
				});
			}
		}
		
		return deliveryResults;
	}
	
	private async createCaseDocumentation(email: Email, context: CaseContext, documents: any[], deliveryResults: any[]): Promise<any> {
		// Create comprehensive case documentation for ce-file system
		console.log('Creating comprehensive case documentation...');
		
		const documentation = {
			documentationId: `case-doc-${email.id}-${Date.now()}`,
			caseSummary: {
				originalEmail: {
					from: email.from,
					subject: email.subject,
					date: email.date,
					messageId: email.messageId
				},
				legalContext: context,
				documentsGenerated: documents.length,
				partiesNotified: deliveryResults.length
			},
			processingTimeline: {
				startedAt: new Date().toISOString(),
				phases: [
					'Email Collection & Filtering (Steps 1-5)',
					'Email Triage (Steps 6-11)',
					'Classification & Action (Steps 12-15)',
					'Document Generation & Delivery (Steps 16-21)'
				],
				completedAt: new Date().toISOString()
			},
			legalAnalysis: {
				complexityLevel: 'high',
				keywords: context.keywords,
				caseReferences: context.caseNumbers,
				relatedCommunications: context.relatedEmails.length
			},
			documentManifest: documents.map(doc => ({
				filename: doc.filename,
				type: doc.type,
				generatedAt: doc.generatedAt,
				size: doc.content ? doc.content.length : 0
			})),
			deliveryReport: deliveryResults,
			status: 'completed',
			account: 'mobicycle'
		};
		
		// Store documentation in ce-file system
		await fetch(`${this.env.CE_FILE_URL}/documentation`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.env.CE_FILE_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(documentation)
		});
		
		return documentation;
	}
	
	private async submitToLegalSystems(documents: any[], context: CaseContext): Promise<any[]> {
		// Submit to court systems, legal databases, etc.
		console.log('Submitting documents to legal systems...');
		
		const submissions = [];
		
		// Example submissions (would be actual court/legal system APIs)
		for (const doc of documents) {
			// Determine appropriate legal system based on document type and context
			let targetSystem = 'general-legal-filing';
			
			if (context.keywords.includes('court')) targetSystem = 'court-filing-system';
			if (context.keywords.includes('ico')) targetSystem = 'ico-submission-portal';
			if (context.keywords.includes('tribunal')) targetSystem = 'tribunal-system';
			
			submissions.push({
				document: doc.filename,
				targetSystem,
				status: 'queued-for-submission',
				submittedAt: new Date().toISOString(),
				confirmationNumber: `SUBMIT-${Date.now()}-${Math.random().toString(36).substring(7)}`
			});
		}
		
		return submissions;
	}
	
	private async uploadToCeFile(documents: any[], email: Email, context: CaseContext): Promise<void> {
		// Upload to ce-file legal document management
		const response = await fetch(`${this.env.CE_FILE_URL}/upload`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.env.CE_FILE_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				documents,
				case: {
					emailId: email.id,
					from: email.from,
					subject: email.subject,
					context
				},
				account: 'mobicycle'
			})
		});
		
		if (!response.ok) {
			throw new Error(`ce-file upload failed: ${response.status}`);
		}
	}
}

export class LegalCaseManager extends DurableObject {
	constructor(state: DurableObjectState, env: any) {
		super(state, env);
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const caseId = url.pathname.split('/')[1];

		switch (request.method) {
			case 'POST':
				return this.createCase(caseId, await request.json());
			case 'GET':
				return this.getCase(caseId);
			case 'PUT':
				return this.updateCase(caseId, await request.json());
			default:
				return new Response('Method not allowed', { status: 405 });
		}
	}

	private async createCase(caseId: string, caseData: any): Promise<Response> {
		await this.state.storage.put(`case-${caseId}`, {
			...caseData,
			createdAt: new Date().toISOString(),
			status: 'active'
		});
		
		return new Response(JSON.stringify({ caseId, status: 'created' }));
	}

	private async getCase(caseId: string): Promise<Response> {
		const caseData = await this.state.storage.get(`case-${caseId}`);
		
		if (!caseData) {
			return new Response('Case not found', { status: 404 });
		}
		
		return new Response(JSON.stringify(caseData));
	}

	private async updateCase(caseId: string, updates: any): Promise<Response> {
		const existing = await this.state.storage.get(`case-${caseId}`);
		
		if (!existing) {
			return new Response('Case not found', { status: 404 });
		}
		
		const updated = {
			...existing,
			...updates,
			updatedAt: new Date().toISOString()
		};
		
		await this.state.storage.put(`case-${caseId}`, updated);
		
		return new Response(JSON.stringify(updated));
	}
}

// Export the workflow for Workers environment
export default {
	// HTTP request handler
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		
		if (url.pathname === '/cron/process-legal-emails') {
			// Trigger the 21-step email triage workflow
			try {
				const instance = await env.EMAIL_TRIAGE.create();
				console.log('[MANUAL TRIGGER] Starting 21-step email triage workflow...');
				
				return new Response(JSON.stringify({
					status: 'triggered',
					instanceId: instance.id,
					message: '21-step email triage workflow started',
					timestamp: new Date().toISOString()
				}), {
					headers: { 'Content-Type': 'application/json' }
				});
			} catch (error) {
				console.error('[MANUAL TRIGGER ERROR]:', error);
				return new Response(JSON.stringify({
					error: 'Failed to start workflow',
					message: error.message,
					timestamp: new Date().toISOString()
				}), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}
		
		if (url.pathname === '/status') {
			return new Response(JSON.stringify({
				service: 'Email Triage Workflow',
				status: 'running',
				timestamp: new Date().toISOString(),
				endpoints: [
					'/cron/process-legal-emails',
					'/status'
				]
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		return new Response('Not Found', { status: 404 });
	}
};

