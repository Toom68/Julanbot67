import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Users, Brain, MessageSquare, Image, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { fetchKnowledge, fetchMessages, fetchPeople, type DashboardMessage, type KnowledgeEntry, type PersonSummary } from '../lib/api';

function isWithinDays(value: string, days: number) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000;
}

function buildWeeklyActivity(messages: DashboardMessage[], knowledge: KnowledgeEntry[]) {
  const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));

    return {
      key: date.toISOString().slice(0, 10),
      name: formatter.format(date),
      messages: 0,
      facts: 0,
    };
  });

  const bucketByDay = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  messages.forEach((message) => {
    const key = message.timestamp.slice(0, 10);
    const bucket = bucketByDay.get(key);

    if (bucket) {
      bucket.messages += 1;
    }
  });

  knowledge.forEach((fact) => {
    const key = fact.observedAt.slice(0, 10);
    const bucket = bucketByDay.get(key);

    if (bucket) {
      bucket.facts += 1;
    }
  });

  return buckets;
}

export function Analytics() {
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        const [peoplePayload, messagesPayload, knowledgePayload] = await Promise.all([
          fetchPeople(),
          fetchMessages(),
          fetchKnowledge(),
        ]);

        setPeople(peoplePayload.people || []);
        setMessages(messagesPayload.messages || []);
        setKnowledge(knowledgePayload.knowledge || []);
      } catch (loadError) {
        console.error(loadError);
        setError('Unable to load live analytics right now.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const activityData = useMemo(
    () => buildWeeklyActivity(messages, knowledge),
    [knowledge, messages]
  );

  const categoryData = useMemo(() => {
    const counts = new Map<string, number>();

    knowledge.forEach((fact) => {
      counts.set(fact.category, (counts.get(fact.category) || 0) + 1);
    });

    return [...counts.entries()]
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }, [knowledge]);

  const totalPeople = people.length;
  const totalFacts = knowledge.length;
  const activePeople = people.filter((person) => isWithinDays(person.lastSeenAt, 3)).length;
  const avgFactsPerPerson = totalPeople ? (totalFacts / totalPeople).toFixed(1) : '0.0';
  const mediaCount = messages.reduce((sum, message) => sum + message.images.length + message.videos.length + message.gifs.length, 0);

  const mostActive = useMemo(
    () => [...people].sort((a, b) => b.messageCount - a.messageCount).slice(0, 5),
    [people]
  );

  const mostRemembered = useMemo(
    () => [...people].sort((a, b) => b.factCount - a.factCount).slice(0, 5),
    [people]
  );

  const recentEvents = useMemo(() => {
    const events = [
      ...people.slice(0, 5).map((person) => ({
        event: 'Profile updated',
        detail: `${person.displayName} active in ${person.lastServer || 'DM'}`,
        time: person.lastSeenAt,
      })),
      ...knowledge.slice(0, 5).map((fact) => ({
        event: 'Knowledge extracted',
        detail: `${fact.username}: ${fact.fact}`,
        time: fact.observedAt,
      })),
      ...messages
        .filter((message) => message.images.length + message.videos.length + message.gifs.length > 0)
        .slice(0, 5)
        .map((message) => ({
          event: 'Media captured',
          detail: `${message.sender} shared ${message.images.length + message.videos.length + message.gifs.length} attachment(s)`,
          time: message.timestamp,
        })),
    ];

    return events
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 6);
  }, [knowledge, messages, people]);

  return (
    <div className="w-full h-full overflow-auto">
      {/* Header */}
      <motion.div
        className="px-12 py-8 border-b border-border/30"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-4xl tracking-tight mb-2">Analytics</h1>
        <p className="text-silver-soft/70">Insights into your Discord community and knowledge base</p>
      </motion.div>

      {/* Content */}
      <div className="px-12 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {error && (
            <div className="glass-panel p-6 text-red-300">{error}</div>
          )}

          {loading && !error && (
            <div className="glass-panel p-6 text-silver-soft/70">Loading live analytics...</div>
          )}

          {/* Key Metrics */}
          <motion.div
            className="grid grid-cols-4 gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="glass-panel p-6 space-y-3">
              <div className="flex items-center justify-between">
                <Users className="text-cyan-glow" size={24} />
                <div className="text-xs glass-panel px-2 py-1 text-cyan-glow">Live</div>
              </div>
              <div className="text-3xl">{totalPeople}</div>
              <div className="text-sm text-silver-soft/60">Total People</div>
            </div>

            <div className="glass-panel p-6 space-y-3">
              <div className="flex items-center justify-between">
                <Brain className="text-violet-smoke" size={24} />
                <div className="text-xs glass-panel px-2 py-1 text-violet-smoke">Knowledge</div>
              </div>
              <div className="text-3xl">{totalFacts}</div>
              <div className="text-sm text-silver-soft/60">Remembered Facts</div>
            </div>

            <div className="glass-panel p-6 space-y-3">
              <div className="flex items-center justify-between">
                <Activity className="text-warm-accent" size={24} />
                <div className="text-xs glass-panel px-2 py-1 text-green-400">72h</div>
              </div>
              <div className="text-3xl">{activePeople}</div>
              <div className="text-sm text-silver-soft/60">Active Now</div>
            </div>

            <div className="glass-panel p-6 space-y-3">
              <div className="flex items-center justify-between">
                <TrendingUp className="text-electric-blue" size={24} />
                <div className="text-xs glass-panel px-2 py-1 text-cyan-glow">Avg</div>
              </div>
              <div className="text-3xl">{avgFactsPerPerson}</div>
              <div className="text-sm text-silver-soft/60">Facts per Person</div>
            </div>
          </motion.div>

          <motion.div
            className="glass-panel p-5 flex items-center justify-between gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            <div>
              <div className="text-lg">Media captured</div>
              <div className="text-sm text-silver-soft/60">Images, videos, and GIFs extracted from the live message archive</div>
            </div>
            <div className="text-3xl text-electric-blue">{mediaCount}</div>
          </motion.div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-8">
            {/* Activity Chart */}
            <motion.div
              className="glass-panel p-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <MessageSquare className="text-cyan-glow" size={24} />
                <h2 className="text-2xl">Weekly Activity</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 110, 150, 0.1)" />
                  <XAxis dataKey="name" stroke="#8a8da0" />
                  <YAxis stroke="#8a8da0" />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 18, 35, 0.95)',
                      border: '1px solid rgba(100, 110, 150, 0.2)',
                      borderRadius: '8px',
                      color: '#e8eaf0',
                    }}
                  />
                  <Line type="monotone" dataKey="messages" stroke="#00d9ff" strokeWidth={2} />
                  <Line type="monotone" dataKey="facts" stroke="#8b7aff" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Category Distribution */}
            <motion.div
              className="glass-panel p-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <Brain className="text-violet-smoke" size={24} />
                <h2 className="text-2xl">Knowledge Categories</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 110, 150, 0.1)" />
                  <XAxis dataKey="name" stroke="#8a8da0" />
                  <YAxis stroke="#8a8da0" />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 18, 35, 0.95)',
                      border: '1px solid rgba(100, 110, 150, 0.2)',
                      borderRadius: '8px',
                      color: '#e8eaf0',
                    }}
                  />
                  <Bar dataKey="count" fill="#8b7aff" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Leaderboards */}
          <div className="grid grid-cols-2 gap-8">
            {/* Most Active */}
            <motion.div
              className="glass-panel p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="flex items-center gap-3 mb-6 border-b border-border/30 pb-4">
                <TrendingUp className="text-warm-accent" size={24} />
                <h2 className="text-2xl">Most Active People</h2>
              </div>
              <div className="space-y-3">
                {mostActive.map((person, index) => (
                  <motion.div
                    key={person.userId}
                    className="flex items-center gap-4 glass-panel p-4"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="text-2xl text-cyan-glow/60 w-8">#{index + 1}</div>
                    <div className="w-10 h-10 rounded-lg overflow-hidden glass-panel flex items-center justify-center text-white/90">
                      {person.avatarUrl ? (
                        <img src={person.avatarUrl} alt={person.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm">{person.displayName.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-foreground">{person.displayName}</div>
                      <div className="text-xs text-silver-soft/60">@{person.username}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg text-cyan-glow">{person.messageCount}</div>
                      <div className="text-xs text-silver-soft/60">messages</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Most Remembered */}
            <motion.div
              className="glass-panel p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-6 border-b border-border/30 pb-4">
                <Brain className="text-violet-smoke" size={24} />
                <h2 className="text-2xl">Most Remembered</h2>
              </div>
              <div className="space-y-3">
                {mostRemembered.map((person, index) => (
                  <motion.div
                    key={person.userId}
                    className="flex items-center gap-4 glass-panel p-4"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="text-2xl text-violet-smoke/60 w-8">#{index + 1}</div>
                    <div className="w-10 h-10 rounded-lg overflow-hidden glass-panel flex items-center justify-center text-white/90">
                      {person.avatarUrl ? (
                        <img src={person.avatarUrl} alt={person.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm">{person.displayName.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-foreground">{person.displayName}</div>
                      <div className="text-xs text-silver-soft/60">@{person.username}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg text-violet-smoke">{person.factCount}</div>
                      <div className="text-xs text-silver-soft/60">facts</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Recent System Events */}
          <motion.div
            className="glass-panel p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-6 border-b border-border/30 pb-4">
              <Activity className="text-cyan-glow" size={24} />
              <h2 className="text-2xl">Recent System Events</h2>
            </div>
            <div className="space-y-2">
              {recentEvents.map((item, index) => (
                <motion.div
                  key={index}
                  className="flex items-center justify-between py-3 border-b border-border/10 last:border-0"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                >
                  <div className="flex-1">
                    <div className="text-foreground">{item.event}</div>
                    <div className="text-sm text-silver-soft/60">{item.detail}</div>
                  </div>
                  <div className="text-xs text-silver-soft/60">{new Date(item.time).toLocaleString()}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
