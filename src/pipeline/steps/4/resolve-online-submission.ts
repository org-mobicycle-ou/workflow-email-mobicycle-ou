export async function resolveOnlineSubmission(key: string, email: any): Promise<{ action: string; output?: any }> {
  return { action: 'submit_to_portal', output: { status: 'pending_implementation' } };
}
