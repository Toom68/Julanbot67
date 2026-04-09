export interface PersonSummary {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastMessage: string;
  messageCount: number;
  factCount: number;
  lastChannel: string;
  lastServer: string;
}

export interface DashboardMessage {
  timestamp: string;
  sender: string;
  message: string;
  images: string[];
  videos: string[];
  gifs: string[];
  threadId?: string;
  threadStartedAt?: string;
  threadEndedAt?: string;
  threadMessageCount?: number;
}

export interface ConversationThread {
  threadId: string;
  title: string;
  startedAt: string;
  endedAt: string;
  messageCount: number;
  participants: string[];
  messages: DashboardMessage[];
}

export interface JulianScanMessage {
  messageId: string;
  timestamp: string;
  authorUserId: string;
  authorUsername: string;
  message: string;
  images: string[];
  videos: string[];
  gifs: string[];
  factsAdded: number;
  threadId?: string;
  threadStartedAt?: string;
  threadEndedAt?: string;
  threadMessageCount?: number;
}

export interface JulianScanRun {
  scanId: string;
  triggeredByUserId: string;
  triggeredByUsername: string;
  triggeredAt: string;
  channel: string;
  server: string;
  totalMessages: number;
  totalFactsAdded: number;
  threads: ConversationThread[];
  messages: JulianScanMessage[];
}

export interface KnowledgeEntry {
  userId: string;
  username: string;
  category: string;
  fact: string;
  sourceMessage: string;
  observedAt: string;
  channel: string;
  server: string;
}

export interface PersonProfilePayload {
  person: PersonSummary;
  messages: DashboardMessage[];
  knowledge: KnowledgeEntry[];
}

const apiBase = '';

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchPeople() {
  return fetchJson<{ people: PersonSummary[] }>('/api/people');
}

export async function fetchPersonProfile(userId: string) {
  return fetchJson<PersonProfilePayload>(`/api/people/${encodeURIComponent(userId)}`);
}

export async function fetchMessages() {
  return fetchJson<{ messages: DashboardMessage[]; threads: ConversationThread[] }>('/api/messages');
}

export async function fetchKnowledge() {
  return fetchJson<{ knowledge: KnowledgeEntry[] }>('/api/knowledge');
}

export async function fetchJulianScans() {
  return fetchJson<{ scans: JulianScanRun[] }>('/api/julian-scans');
}
