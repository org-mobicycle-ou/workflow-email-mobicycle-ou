var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { WorkflowEntrypoint } from "cloudflare:workers";
var EmailTriageWorkflow = class extends WorkflowEntrypoint {
  static {
    __name(this, "EmailTriageWorkflow");
  }
  async run(event, step) {
    const connection = await step.do("connect-protonmail-bridge", async () => {
      const tunnelUrl = this.env.TUNNEL_URL || "https://imap.mobicycle.ee";
      console.log(`Connecting to Protonmail Bridge at ${tunnelUrl}`);
      const healthCheck = await fetch(`${tunnelUrl}/health`);
      if (!healthCheck.ok) {
        throw new Error(`Protonmail Bridge connection failed: ${healthCheck.status}`);
      }
      const health = await healthCheck.json();
      return { tunnelUrl, connected: true, email: health.config?.email };
    });
    const emails = await step.do(
      "retrieve-emails",
      { retries: { limit: 3, delay: "10 seconds", backoff: "exponential" } },
      async () => {
        const response = await fetch(`${connection.tunnelUrl}/fetch-emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account: this.env.PROTON_EMAIL,
            folder: "INBOX",
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
    const relevantEmails = await step.do("filter-whitelist", async () => {
      const allowedDomains = [
        ".court",
        ".gov.uk",
        ".ee",
        "@ico.org.uk",
        "@ombudsman.org.uk",
        "@parliament.uk"
      ];
      return emails.filter((email) => {
        return allowedDomains.some((domain) => email.from.includes(domain));
      });
    });
    console.log(`${relevantEmails.length} emails passed whitelist`);
    const distributed = await step.do("distribute-to-kv", async () => {
      const results = [];
      for (const email of relevantEmails) {
        const kvNamespace = this.getKVNamespaceForEmail(email.from);
        if (kvNamespace) {
          const emailKey = this.generateEmailKey(email);
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
    for (const result of distributed) {
      const emailId = result.emailId;
      await step.do(`process-${emailId}`, async () => {
        console.log(`Processing email ${emailId}`);
        return { processed: true, emailId };
      });
    }
    await step.do("log-completion", async () => {
      return {
        workflowId: event.instanceId,
        completed: (/* @__PURE__ */ new Date()).toISOString(),
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
  getKVNamespaceForEmail(emailAddress) {
    const email = emailAddress.toLowerCase();
    if (email.includes("supremecourt") || email.includes("uksc")) {
      return this.env.EMAIL_COURTS_SUPREME_COURT;
    }
    if (email.includes("admin.court") || email.includes("administrativecourt")) {
      return this.env.EMAIL_COURTS_ADMINISTRATIVE_COURT;
    }
    if (email.includes("chancerydivision")) {
      return this.env.EMAIL_COURTS_CHANCERY_DIVISION;
    }
    if (email.includes("ico.org.uk")) {
      return this.env.EMAIL_COMPLAINTS_ICO;
    }
    if (email.includes("ombudsman.org.uk")) {
      return this.env.EMAIL_COMPLAINTS_PHSO;
    }
    if (email.includes("parliament.uk")) {
      return this.env.EMAIL_COMPLAINTS_PARLIAMENT;
    }
    if (email.includes(".ee") && email.includes("gov")) {
      return this.env.EMAIL_GOVERNMENT_ESTONIA;
    }
    if (email.includes("gov.uk") && email.includes("legal")) {
      return this.env.EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT;
    }
    return null;
  }
  // Helper: Generate unique email key
  generateEmailKey(email) {
    const emailDate = new Date(email.date);
    const year = emailDate.getUTCFullYear();
    const month = (emailDate.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = emailDate.getUTCDate().toString().padStart(2, "0");
    const dateStr = `${year}.${month}.${day}`;
    const hours = emailDate.getUTCHours().toString().padStart(2, "0");
    const minutes = emailDate.getUTCMinutes().toString().padStart(2, "0");
    const senderKey = email.from.replace(/[^a-zA-Z0-9@._-]/g, "_");
    return `${dateStr}_${senderKey}_${hours}:${minutes}`;
  }
};
var index_default = {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    const instance = await env.EMAIL_TRIAGE.create({
      params: {
        batchId: crypto.randomUUID(),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    return new Response(JSON.stringify({
      workflowId: instance.id,
      status: "started",
      message: "Email triage workflow started"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
};
export {
  EmailTriageWorkflow,
  index_default as default
};
//# sourceMappingURL=index.js.map
