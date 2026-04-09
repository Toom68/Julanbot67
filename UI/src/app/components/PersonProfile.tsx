import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  MessageSquare,
  Brain,
  Calendar,
  Clock,
  Tag,
  MapPin,
  Briefcase,
  GraduationCap,
  Heart,
  Settings,
  User,
} from 'lucide-react';
import { fetchPersonProfile, type KnowledgeEntry, type PersonProfilePayload, type PersonSummary } from '../lib/api';

function formatDateTime(value: string) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatDate(value: string) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function getInitials(person: PersonSummary) {
  const source = person.displayName || person.username || 'U';

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function PersonProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PersonProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!id) {
        setError('Missing person id.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const payload = await fetchPersonProfile(id);
        setProfile(payload);
      } catch (loadError) {
        console.error(loadError);
        setError('Unable to load this person profile right now.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [id]);

  const factsByCategory = useMemo(() => {
    return (profile?.knowledge || []).reduce<Record<string, KnowledgeEntry[]>>((accumulator, entry) => {
      if (!accumulator[entry.category]) {
        accumulator[entry.category] = [];
      }

      accumulator[entry.category].push(entry);
      return accumulator;
    }, {});
  }, [profile]);

  const categoryIcons = {
    identity: User,
    profile: Tag,
    work: Briefcase,
    education: GraduationCap,
    preference: Heart,
    preferences: Heart,
    project: Settings,
    projects: Settings,
    location: MapPin,
    contact: Tag,
    tooling: Settings,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="glass-panel px-6 py-4 text-silver-soft/70">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <h2 className="text-2xl">{error || 'Person not found'}</h2>
          <button
            onClick={() => navigate('/')}
            className="glass-panel px-6 py-3 text-cyan-glow hover:glass-glow transition-all"
          >
            Back to Directory
          </button>
        </div>
      </div>
    );
  }

  const { person, knowledge, messages } = profile;

  return (
    <div className="w-full h-full overflow-auto">
      <motion.div
        className="relative px-12 py-8 border-b border-border/30"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-silver-soft/70 hover:text-cyan-glow transition-colors mb-6"
        >
          <ArrowLeft size={20} />
          Back to Directory
        </button>

        <div className="flex flex-col xl:flex-row xl:items-end gap-6">
          <motion.div
            className="relative"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45 }}
          >
            <div className="w-32 h-32 rounded-[2rem] glass-panel overflow-hidden flex items-center justify-center glass-glow text-4xl text-white/90">
              {person.avatarUrl ? (
                <img src={person.avatarUrl} alt={person.displayName} className="w-full h-full object-cover" />
              ) : (
                <span>{getInitials(person)}</span>
              )}
            </div>
            <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full border-4 border-background bg-emerald-400" />
          </motion.div>

          <div className="flex-1">
            <motion.h1
              className="text-4xl mb-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
            >
              {person.displayName}
            </motion.h1>
            <motion.p
              className="text-lg text-silver-soft/70 mb-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              @{person.username}
            </motion.p>

            <motion.p
              className="text-silver-soft/80 mb-6 max-w-3xl"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              {person.lastMessage || 'No recent message stored yet.'}
            </motion.p>

            <div className="flex flex-wrap gap-3 mb-6">
              <span className="glass-panel px-3 py-2 text-sm text-cyan-glow/90">{person.messageCount} messages</span>
              <span className="glass-panel px-3 py-2 text-sm text-violet-smoke">{person.factCount} facts</span>
              <span className="glass-panel px-3 py-2 text-sm text-silver-soft/80">{person.lastServer || 'DM'}</span>
              <span className="glass-panel px-3 py-2 text-sm text-silver-soft/80">#{person.lastChannel || 'unknown'}</span>
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2 text-silver-soft/70">
                <Calendar size={16} className="text-warm-accent" />
                First seen {formatDate(person.firstSeenAt)}
              </div>
              <div className="flex items-center gap-2 text-silver-soft/70">
                <Clock size={16} className="text-cyan-glow" />
                Last seen {formatDateTime(person.lastSeenAt)}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="px-12 py-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 2xl:grid-cols-[1.1fr_0.9fr] gap-8">
          <motion.div
            className="glass-panel p-6 space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 border-b border-border/30 pb-4">
              <Brain className="text-cyan-glow" size={24} />
              <h2 className="text-2xl">Remembered Facts</h2>
            </div>

            {!knowledge.length && (
              <div className="text-silver-soft/60">No knowledge stored for this person yet.</div>
            )}

            <div className="space-y-5 max-h-[640px] overflow-auto pr-2">
              {Object.entries(factsByCategory).map(([category, entries]) => {
                const Icon = categoryIcons[category as keyof typeof categoryIcons] || Tag;

                return (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-silver-soft/70 capitalize">
                      <Icon size={16} />
                      {category}
                    </div>

                    {entries.map((entry, index) => (
                      <motion.div
                        key={`${entry.userId}-${entry.category}-${entry.fact}-${index}`}
                        className="glass-panel p-4 space-y-3"
                        whileHover={{ scale: 1.01 }}
                      >
                        <p className="text-foreground">{entry.fact}</p>
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-silver-soft/60">
                          <span>{entry.server || 'DM'} • #{entry.channel || 'unknown'}</span>
                          <span>{formatDateTime(entry.observedAt)}</span>
                        </div>
                        {entry.sourceMessage && (
                          <div className="text-sm text-silver-soft/55 border-t border-border/20 pt-3">
                            Source: {entry.sourceMessage}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="glass-panel p-6 space-y-6">
              <div className="flex items-center gap-3 border-b border-border/30 pb-4">
                <MessageSquare className="text-violet-smoke" size={24} />
                <h2 className="text-2xl">Recent Messages</h2>
              </div>

              {!messages.length && (
                <div className="text-silver-soft/60">No messages available yet.</div>
              )}

              <div className="space-y-4">
                {messages.map((message, index) => (
                  <motion.div
                    key={`${message.timestamp}-${index}`}
                    className="glass-panel p-4 space-y-3"
                    whileHover={{ scale: 1.01 }}
                  >
                    <p className="text-foreground leading-7">{message.message || 'No message text.'}</p>
                    <div className="flex items-center justify-between gap-3 text-xs text-silver-soft/60">
                      <span>{formatDateTime(message.timestamp)}</span>
                      <span>
                        {message.images.length + message.videos.length + message.gifs.length} media items
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-6 space-y-5">
              <div className="flex items-center gap-3 border-b border-border/30 pb-4">
                <Clock className="text-warm-accent" size={24} />
                <h2 className="text-2xl">Activity Snapshot</h2>
              </div>

              <div className="space-y-3">
                <div className="glass-panel p-4 flex items-center justify-between gap-4">
                  <span className="text-silver-soft/70">Latest channel</span>
                  <span>#{person.lastChannel || 'unknown'}</span>
                </div>
                <div className="glass-panel p-4 flex items-center justify-between gap-4">
                  <span className="text-silver-soft/70">Latest server</span>
                  <span>{person.lastServer || 'DM'}</span>
                </div>
                <div className="glass-panel p-4 flex items-center justify-between gap-4">
                  <span className="text-silver-soft/70">Messages tracked</span>
                  <span>{person.messageCount}</span>
                </div>
                <div className="glass-panel p-4 flex items-center justify-between gap-4">
                  <span className="text-silver-soft/70">Facts stored</span>
                  <span>{person.factCount}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
