// Test Cloudflare Worker → port 4000 → port 1143 workflow

export default {
  async fetch(request, env) {
    
    // Step 1: Cloudflare Worker calls backend (port 4000)
    console.log('Step 1: Cloudflare Worker calling backend...');
    
    const backendResponse = await fetch('https://imap.mobicycle.ee/fetch-emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account: 'rose@mobicycle.ee',
        folder: 'INBOX',
        limit: 2
      })
    });
    
    if (!backendResponse.ok) {
      return new Response(`Backend error: ${backendResponse.status}`, { status: 500 });
    }
    
    const emailData = await backendResponse.json();
    
    // Step 2: Process the email data from port 1143
    console.log('Step 2: Processing email data from ProtonMail Bridge...');
    
    const result = {
      workflow: 'SUCCESS',
      dataFlow: 'Cloudflare Worker → imap.mobicycle.ee (port 4000) → localhost:1143',
      emailsReceived: emailData.count,
      sampleEmail: emailData.emails?.[0] ? {
        from: emailData.emails[0].from,
        subject: emailData.emails[0].subject,
        date: emailData.emails[0].date,
        bodyPreview: emailData.emails[0].body?.substring(0, 100) + '...'
      } : null,
      rawDataAccess: true,
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};