export interface Person {
  id: string;
  name: string;
  username: string;
  avatar: string;
  status: 'online' | 'idle' | 'offline';
  joinedDate: string;
  lastSeen: string;
  messageCount: number;
  factCount: number;
  tags: string[];
  bio?: string;
}

export interface Fact {
  id: string;
  personId: string;
  personName: string;
  category: 'identity' | 'work' | 'education' | 'preferences' | 'projects' | 'contact' | 'location' | 'interests';
  content: string;
  source: string;
  confidence: number;
  lastObserved: string;
}

export interface Message {
  id: string;
  personId: string;
  personName: string;
  content: string;
  timestamp: string;
  channel: string;
  server: string;
  hasAttachment: boolean;
}

export interface Media {
  id: string;
  personId: string;
  personName: string;
  type: 'image' | 'video' | 'gif';
  url: string;
  thumbnail: string;
  timestamp: string;
  channel: string;
}

const avatarColors = [
  'linear-gradient(135deg, #00d9ff 0%, #0080ff 100%)',
  'linear-gradient(135deg, #8b7aff 0%, #6b4aff 100%)',
  'linear-gradient(135deg, #ff6b9d 0%, #ff4466 100%)',
  'linear-gradient(135deg, #00ffa3 0%, #00d980 100%)',
  'linear-gradient(135deg, #ffa94d 0%, #ff8800 100%)',
];

export const mockPeople: Person[] = [
  {
    id: '1',
    name: 'Alex Rivera',
    username: 'alexr',
    avatar: avatarColors[0],
    status: 'online',
    joinedDate: '2024-01-15',
    lastSeen: '2 minutes ago',
    messageCount: 1247,
    factCount: 23,
    tags: ['Developer', 'AI Enthusiast', 'Team Lead'],
    bio: 'Full-stack developer passionate about AI and user experience',
  },
  {
    id: '2',
    name: 'Jordan Chen',
    username: 'jchen',
    avatar: avatarColors[1],
    status: 'online',
    joinedDate: '2024-02-20',
    lastSeen: '15 minutes ago',
    messageCount: 892,
    factCount: 18,
    tags: ['Designer', 'Creative', 'Mentor'],
    bio: 'Product designer crafting delightful experiences',
  },
  {
    id: '3',
    name: 'Sam Torres',
    username: 'storres',
    avatar: avatarColors[2],
    status: 'idle',
    joinedDate: '2023-11-10',
    lastSeen: '2 hours ago',
    messageCount: 2103,
    factCount: 31,
    tags: ['Engineer', 'Open Source', 'Community'],
    bio: 'Building tools that make developers happy',
  },
  {
    id: '4',
    name: 'Riley Park',
    username: 'rpark',
    avatar: avatarColors[3],
    status: 'online',
    joinedDate: '2024-03-05',
    lastSeen: '5 minutes ago',
    messageCount: 645,
    factCount: 15,
    tags: ['Data Science', 'ML Engineer', 'Researcher'],
    bio: 'Exploring the intersection of data and intelligence',
  },
  {
    id: '5',
    name: 'Morgan Lee',
    username: 'mlee',
    avatar: avatarColors[4],
    status: 'offline',
    joinedDate: '2023-09-22',
    lastSeen: '1 day ago',
    messageCount: 1534,
    factCount: 27,
    tags: ['DevOps', 'Cloud', 'Infrastructure'],
    bio: 'Scaling systems and automating everything',
  },
  {
    id: '6',
    name: 'Casey Kim',
    username: 'ckim',
    avatar: avatarColors[0],
    status: 'online',
    joinedDate: '2024-01-28',
    lastSeen: '10 minutes ago',
    messageCount: 778,
    factCount: 12,
    tags: ['Frontend', 'React', 'Animation'],
    bio: 'Bringing interfaces to life with motion',
  },
  {
    id: '7',
    name: 'Avery Walsh',
    username: 'awalsh',
    avatar: avatarColors[1],
    status: 'idle',
    joinedDate: '2023-12-14',
    lastSeen: '3 hours ago',
    messageCount: 1089,
    factCount: 20,
    tags: ['Security', 'Blockchain', 'Privacy'],
    bio: 'Protecting digital identities and assets',
  },
  {
    id: '8',
    name: 'Drew Santos',
    username: 'dsantos',
    avatar: avatarColors[2],
    status: 'online',
    joinedDate: '2024-02-11',
    lastSeen: '1 minute ago',
    messageCount: 934,
    factCount: 16,
    tags: ['Product Manager', 'Strategy', 'Growth'],
    bio: 'Connecting user needs with business value',
  },
];

export const mockFacts: Fact[] = [
  {
    id: 'f1',
    personId: '1',
    personName: 'Alex Rivera',
    category: 'work',
    content: 'Works as Senior Full-Stack Developer at TechCorp',
    source: '#general',
    confidence: 0.95,
    lastObserved: '2024-04-08',
  },
  {
    id: 'f2',
    personId: '1',
    personName: 'Alex Rivera',
    category: 'interests',
    content: 'Passionate about AI and machine learning',
    source: '#tech-talk',
    confidence: 0.92,
    lastObserved: '2024-04-09',
  },
  {
    id: 'f3',
    personId: '1',
    personName: 'Alex Rivera',
    category: 'preferences',
    content: 'Prefers TypeScript over JavaScript',
    source: '#dev-chat',
    confidence: 0.88,
    lastObserved: '2024-04-07',
  },
  {
    id: 'f4',
    personId: '2',
    personName: 'Jordan Chen',
    category: 'work',
    content: 'Lead Product Designer at DesignLab',
    source: '#introductions',
    confidence: 0.97,
    lastObserved: '2024-04-06',
  },
  {
    id: 'f5',
    personId: '2',
    personName: 'Jordan Chen',
    category: 'education',
    content: 'Studied Design at Parsons School of Design',
    source: '#design',
    confidence: 0.90,
    lastObserved: '2024-04-05',
  },
  {
    id: 'f6',
    personId: '3',
    personName: 'Sam Torres',
    category: 'projects',
    content: 'Maintains several popular open-source libraries',
    source: '#open-source',
    confidence: 0.94,
    lastObserved: '2024-04-08',
  },
  {
    id: 'f7',
    personId: '3',
    personName: 'Sam Torres',
    category: 'location',
    content: 'Based in San Francisco, CA',
    source: '#general',
    confidence: 0.89,
    lastObserved: '2024-04-04',
  },
  {
    id: 'f8',
    personId: '4',
    personName: 'Riley Park',
    category: 'work',
    content: 'ML Engineer at DataCorp',
    source: '#data-science',
    confidence: 0.96,
    lastObserved: '2024-04-09',
  },
];

export const mockMessages: Message[] = [
  {
    id: 'm1',
    personId: '1',
    personName: 'Alex Rivera',
    content: 'Just finished implementing the new authentication flow. Ready for review!',
    timestamp: '2024-04-09T14:32:00',
    channel: '#dev-updates',
    server: 'TechCorp',
    hasAttachment: false,
  },
  {
    id: 'm2',
    personId: '2',
    personName: 'Jordan Chen',
    content: 'Love the new design direction! The glassmorphic effects are 🔥',
    timestamp: '2024-04-09T14:15:00',
    channel: '#design',
    server: 'TechCorp',
    hasAttachment: true,
  },
  {
    id: 'm3',
    personId: '3',
    personName: 'Sam Torres',
    content: 'Published v2.0 of the utility library. Check out the changelog!',
    timestamp: '2024-04-09T13:45:00',
    channel: '#announcements',
    server: 'Open Source Hub',
    hasAttachment: false,
  },
  {
    id: 'm4',
    personId: '4',
    personName: 'Riley Park',
    content: 'The new ML model is showing 23% improvement over baseline',
    timestamp: '2024-04-09T12:20:00',
    channel: '#data-science',
    server: 'TechCorp',
    hasAttachment: true,
  },
];

export const mockMedia: Media[] = [
  {
    id: 'md1',
    personId: '2',
    personName: 'Jordan Chen',
    type: 'image',
    url: '',
    thumbnail: avatarColors[1],
    timestamp: '2024-04-09T14:15:00',
    channel: '#design',
  },
  {
    id: 'md2',
    personId: '4',
    personName: 'Riley Park',
    type: 'image',
    url: '',
    thumbnail: avatarColors[3],
    timestamp: '2024-04-09T12:20:00',
    channel: '#data-science',
  },
];
