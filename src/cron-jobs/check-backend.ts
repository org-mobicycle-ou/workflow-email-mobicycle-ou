import type { Env } from '../pipeline/shared/types';

export async function checkBackend(env: Env) {
  const now = new Date().toISOString();
  
  try {
    // Get latest status from all systems
    const tunnelData = await env.DASHBOARD_SCREENSHOTS.get('hop_tunnel');
    const backendData = await env.DASHBOARD_SCREENSHOTS.get('hop_backend');
    const bridgeData = await env.DASHBOARD_SCREENSHOTS.get('hop_bridge');
    const pipelineData = await env.DASHBOARD_SCREENSHOTS.get('pipeline_last_run');
    
    const status = {
      timestamp: now,
      tunnel: tunnelData ? JSON.parse(tunnelData) : null,
      backend: backendData ? JSON.parse(backendData) : null,
      bridge: bridgeData ? JSON.parse(bridgeData) : null,
      pipeline: pipelineData ? JSON.parse(pipelineData) : null
    };
    
    console.log('[STATUS] system health updated');
    await env.DASHBOARD_SCREENSHOTS.put('system_status', JSON.stringify(status));
    
    return status;
  } catch (error: any) {
    console.error('[STATUS] error:', error);
    const errorStatus = {
      timestamp: now,
      status: 'error',
      error: error.message
    };
    await env.DASHBOARD_SCREENSHOTS.put('system_status', JSON.stringify(errorStatus));
    return errorStatus;
  }
}