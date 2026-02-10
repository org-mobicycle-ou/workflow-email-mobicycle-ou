import type { Env } from '../pipeline/shared/types';

export async function checkBridge(env: Env) {
  const now = new Date().toISOString();
  
  try {
    const response = await fetch(env.TUNNEL_URL + '/health');
    const data = await response.json();
    
    const result = {
      timestamp: now,
      status: response.ok ? 'ok' : 'error',
      bridge: data
    };
    
    await env.DASHBOARD_SCREENSHOTS.put('hop_bridge', JSON.stringify(result));
    console.log('[BRIDGE] check completed:', result);
    return result;
  } catch (error: any) {
    console.error('[BRIDGE] error:', error);
    const errorResult = { 
      status: 'error', 
      error: error.message, 
      timestamp: now 
    };
    await env.DASHBOARD_SCREENSHOTS.put('hop_bridge', JSON.stringify(errorResult));
    return errorResult;
  }
}