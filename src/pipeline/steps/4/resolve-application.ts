export async function resolveApplication(key: string, email: any): Promise<{ action: string; output?: any }> {
  return { action: 'generate_documents', output: { status: 'pending_implementation' } };
}
