import type { Env } from '../pipeline/shared/types';
import { runPipeline } from '../pipeline/runPipeline';

export async function triggerPipeline(env: Env) {
  const now = new Date().toISOString();
  
  try {
    // Check all three infrastructure statuses
    const tunnelData = await env.DASHBOARD_SCREENSHOTS.get('hop_tunnel');
    const bridgeData = await env.DASHBOARD_SCREENSHOTS.get('hop_bridge');
    const backendData = await env.DASHBOARD_SCREENSHOTS.get('hop_backend');
    
    if (!tunnelData || !bridgeData || !backendData) {
      const result = { 
        timestamp: now, 
        status: 'skipped', 
        reason: 'missing infrastructure status data' 
      };
      await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify(result));
      return result;
    }
    
    const tunnel = JSON.parse(tunnelData);
    const bridge = JSON.parse(bridgeData);
    const backend = JSON.parse(backendData);
    
    if (tunnel.status !== 'ok' || bridge.status !== 'ok' || backend.status !== 'ok') {
      const result = { 
        timestamp: now, 
        status: 'skipped', 
        reason: 'infrastructure not healthy',
        infrastructure: { tunnel: tunnel.status, bridge: bridge.status, backend: backend.status }
      };
      await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify(result));
      return result;
    }
    
    // All infrastructure healthy - run pipeline
    const result = await runPipeline(env);
    console.log('[PIPELINE] completed:', result);
    return result;
  } catch (error: any) {
    console.error('[PIPELINE] error:', error);
    const errorResult = { 
      status: 'error', 
      error: error.message, 
      timestamp: now 
    };
    await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify(errorResult));
    return errorResult;
  }
}