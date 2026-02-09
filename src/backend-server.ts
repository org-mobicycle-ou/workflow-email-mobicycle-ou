#!/usr/bin/env bun

/**
 * ProtonMail Bridge Backend Server for rose@mobicycle.ee
 * Exposes HTTP API for Cloudflare Worker to fetch emails via tunnel
 */

import { ImapFlow } from 'imapflow';

const PORT = 4000;

// ProtonMail Bridge IMAP settings for rose@mobicycle.ee
const IMAP_CONFIG = {
	host: '127.0.0.1',
	port: 1143,
	secure: false,
	auth: {
		user: 'rose@mobicycle.ee',
		pass: 'yeMDbia0cJ45IWvsphn4fA',
	},
	tls: {
		rejectUnauthorized: false,
	},
	logger: false,
};

interface Email {
	id: string;
	from: string;
	to: string;
	subject: string;
	body: string;
	date: string;
	messageId: string;
}

const server = Bun.serve({
	port: PORT,
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// CORS headers
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 200, headers: corsHeaders });
		}

		try {
			// Health check endpoint
			if (path === '/health') {
				return new Response(JSON.stringify({
					status: 'ok',
					service: 'ProtonMail Bridge Backend',
					account: 'rose@mobicycle.ee',
					config: {
						email: IMAP_CONFIG.auth.user,
						bridge: `${IMAP_CONFIG.host}:${IMAP_CONFIG.port}`,
					},
					timestamp: new Date().toISOString(),
				}), {
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}

			// Fetch emails endpoint (used by Cloudflare Worker)
			if (path === '/fetch-emails' && request.method === 'POST') {
				const body = await request.json() as {
					account?: string;
					folder?: string;
					limit?: number;
					unseenOnly?: boolean;
				};

				const folder = body.folder || 'INBOX';
				const limit = body.limit || 50;
				const unseenOnly = body.unseenOnly || false;

				console.log(`Fetching emails: folder=${folder}, limit=${limit}, unseenOnly=${unseenOnly}`);

				const client = new ImapFlow(IMAP_CONFIG);
				await client.connect();

				const lock = await client.getMailboxLock(folder);
				const emails: Email[] = [];

				try {
					// Search criteria
					const searchCriteria = unseenOnly ? { seen: false } : { all: true };
					const messages = await client.search(searchCriteria);

					// Limit results
					const messageIds = messages.slice(-limit);

					if (messageIds.length === 0) {
						return new Response(JSON.stringify({
							success: true,
							count: 0,
							emails: [],
						}), {
							headers: { 'Content-Type': 'application/json', ...corsHeaders },
						});
					}

					// Fetch email details
					for await (const msg of client.fetch(messageIds, {
						envelope: true,
						bodyStructure: true,
						source: true,
					})) {
						const from = msg.envelope?.from?.[0]?.address || 'unknown';
						const to = msg.envelope?.to?.[0]?.address || 'unknown';
						const subject = msg.envelope?.subject || '(no subject)';
						const date = msg.envelope?.date || new Date();
						const messageId = msg.envelope?.messageId || `${msg.uid}`;

						// Get email body (text or html)
						let body = '';
						if (msg.source) {
							const text = msg.source.toString();
							// Simple extraction - just get first 500 chars after headers
							const bodyStart = text.indexOf('\r\n\r\n');
							if (bodyStart > 0) {
								body = text.substring(bodyStart + 4, bodyStart + 504);
							}
						}

						emails.push({
							id: `${msg.uid}`,
							from,
							to,
							subject,
							body: body.trim(),
							date: date.toISOString(),
							messageId,
						});
					}
				} finally {
					lock.release();
				}

				await client.logout();

				return new Response(JSON.stringify({
					success: true,
					count: emails.length,
					emails,
				}), {
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}

			// Root endpoint - API info
			if (path === '/') {
				return new Response(JSON.stringify({
					service: 'ProtonMail Bridge Backend API',
					account: 'rose@mobicycle.ee',
					version: '1.0.0',
					endpoints: {
						health: 'GET /health',
						fetchEmails: 'POST /fetch-emails',
					},
					tunnel: 'https://imap.mobicycle.ee',
				}), {
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}

			return new Response('Not Found', { status: 404, headers: corsHeaders });

		} catch (error) {
			console.error('Error:', error);
			return new Response(JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json', ...corsHeaders },
			});
		}
	},
});

console.log(`🚀 ProtonMail Bridge Backend running on http://localhost:${PORT}`);
console.log(`📧 Account: ${IMAP_CONFIG.auth.user}`);
console.log(`🌉 Bridge: ${IMAP_CONFIG.host}:${IMAP_CONFIG.port}`);
console.log(`🔗 Tunnel: https://imap.mobicycle.ee`);
console.log('\nEndpoints:');
console.log('  GET  /health');
console.log('  POST /fetch-emails');
