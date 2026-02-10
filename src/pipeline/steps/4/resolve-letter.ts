export async function resolveLetter(key: string, email: any): Promise<{ action: string; output?: any }> {
  return { action: 'draft_letter', output: { status: 'pending_implementation' } };
}
