export async function resolveEmailCoverLetter(key: string, email: any): Promise<{ action: string; output?: any }> {
  return { action: 'draft_cover_letter', output: { status: 'pending_implementation' } };
}
