import type { Env } from '../shared/types';
import { NAMESPACE_META } from '../shared/kv-bindings';

interface TodoItem {
  key: string;
  namespace: string;
  category: string;
  subject: string;
  from: string;
  date: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  actionRequired: string;
}

export async function handleTodoScanner(request: Request, env: Env): Promise<Response> {
  const todos: TodoItem[] = [];
  
  // Scan all KV namespaces for emails needing action
  for (const [slug, meta] of Object.entries(NAMESPACE_META)) {
    const binding = meta.binding as keyof Env;
    const namespace = env[binding] as KVNamespace;
    
    if (!namespace) continue;
    
    const { keys } = await namespace.list({ limit: 10 }); // Get 10 most recent per namespace
    
    for (const key of keys) {
      const raw = await namespace.get(key.name);
      if (!raw) continue;
      
      const email = JSON.parse(raw);
      
      // Skip if already processed
      if (email.status === 'completed' || email.status === 'closed') continue;
      
      const priority = determinePriority(email, meta.category);
      const actionRequired = determineAction(email, meta.category);
      
      todos.push({
        key: key.name,
        namespace: meta.name,
        category: meta.category,
        subject: email.subject || 'No Subject',
        from: email.from || 'Unknown',
        date: email.date || new Date().toISOString(),
        priority,
        actionRequired
      });
    }
  }
  
  // Sort by priority and date (most recent urgent items first)
  todos.sort((a, b) => {
    const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Same priority, sort by date (newest first)
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  
  const mostRecent = todos[0]; // Highest priority, most recent
  
  return Response.json({
    totalTodos: todos.length,
    mostRecentAction: mostRecent,
    topTodos: todos.slice(0, 10),
    byPriority: {
      urgent: todos.filter(t => t.priority === 'URGENT').length,
      high: todos.filter(t => t.priority === 'HIGH').length,
      medium: todos.filter(t => t.priority === 'MEDIUM').length,
      low: todos.filter(t => t.priority === 'LOW').length
    }
  });
}

function determinePriority(email: any, category: string): 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const subject = (email.subject || '').toLowerCase();
  const from = (email.from || '').toLowerCase();
  
  // Urgent keywords
  const urgentKeywords = [
    'urgent', 'immediate', 'deadline', 'hearing', 'court date',
    'time limit', 'final notice', 'judgment', 'order'
  ];
  
  if (urgentKeywords.some(keyword => subject.includes(keyword))) {
    return 'URGENT';
  }
  
  // High priority by category
  if (category === 'Courts' || category === 'Reconsideration') {
    return 'HIGH';
  }
  
  if (category === 'Complaints' && from.includes('ombudsman')) {
    return 'HIGH';
  }
  
  // Medium priority for legal matters
  if (category === 'Legal Expenses' || category === 'Claimants' || category === 'Defendants') {
    return 'MEDIUM';
  }
  
  return 'LOW';
}

function determineAction(email: any, category: string): string {
  const subject = (email.subject || '').toLowerCase();
  
  if (subject.includes('hearing')) {
    return 'Prepare for court hearing';
  }
  
  if (subject.includes('judgment') || subject.includes('order')) {
    return 'Review court decision and determine next steps';
  }
  
  if (subject.includes('transcript')) {
    return 'Review transcript and prepare response';
  }
  
  if (category === 'Complaints') {
    return 'Respond to complaint within required timeframe';
  }
  
  if (category === 'Courts') {
    return 'Review court communication and take required action';
  }
  
  if (category === 'Legal Expenses') {
    return 'Review and process legal expense documentation';
  }
  
  return 'Review email and determine appropriate response';
}