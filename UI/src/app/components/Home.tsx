import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { ArrowUpRight, Brain, RefreshCw, Search, Sparkles, TrendingUp, Users } from 'lucide-react';
import { fetchMessages, fetchPeople, type PersonSummary } from '../lib/api';

function formatRelativeTime(value: string) {
  if (!value) {
    return 'Not seen yet';
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return value;
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return new Date(value).toLocaleDateString();
}

function isRecent(value: string, hours: number) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= hours * 60 * 60 * 1000;
}

function getInitials(person: PersonSummary) {
  const source = person.displayName || person.username || 'U';

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function Home() {
  const navigate = useNavigate();
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [messageTotal, setMessageTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPeople = async () => {
    try {
      setLoading(true);
      setError('');
      const [peoplePayload, messagesPayload] = await Promise.all([
        fetchPeople(),
        fetchMessages(),
      ]);
      setPeople(peoplePayload.people || []);
      setMessageTotal((messagesPayload.messages || []).length);
    } catch (loadError) {
      console.error(loadError);
      setError('Unable to load live people data right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeople();
  }, []);

  const totalFacts = useMemo(
    () => people.reduce((sum, person) => sum + person.factCount, 0),
    [people]
  );

  const activePeopleCount = useMemo(
    () => people.filter((person) => isRecent(person.lastSeenAt, 72)).length,
    [people]
  );

  const sortedPeople = useMemo(
    () => [...people].sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt)),
    [people]
  );

  const spotlightPerson = useMemo(
    () => [...people].sort((left, right) => (right.factCount + right.messageCount) - (left.factCount + left.messageCount))[0] || null,
    [people]
  );

  const filteredPeople = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return sortedPeople.filter((person) => {
      const matchesSearch = !query || [
        person.displayName,
        person.username,
        person.lastChannel,
        person.lastServer,
        person.lastMessage
      ].some((value) => value.toLowerCase().includes(query));

      if (!matchesSearch) {
        return false;
      }

      if (activeFilter === 'active') {
        return isRecent(person.lastSeenAt, 72);
      }

      if (activeFilter === 'remembered') {
        return person.factCount > 0;
      }

      if (activeFilter === 'priority') {
        return person.messageCount >= 5 || person.factCount >= 3;
      }

      return true;
    });
  }, [activeFilter, searchQuery, sortedPeople]);

  const filters = [
    { id: 'all', label: 'All People', count: people.length },
    { id: 'active', label: 'Recently Active', count: activePeopleCount },
    { id: 'remembered', label: 'Remembered', count: people.filter((person) => person.factCount > 0).length },
    { id: 'priority', label: 'Priority', count: people.filter((person) => person.messageCount >= 5 || person.factCount >= 3).length },
  ];

  const recentPeople = sortedPeople.slice(0, 4);
  const strongestProfiles = [...people]
    .sort((left, right) => right.factCount - left.factCount)
    .slice(0, 4);

  return (
    <div className="w-full h-full relative overflow-auto">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(24)].map((_, i) => (
          <motion.div
            key={`particle-${i}`}
            className="absolute rounded-full"
            style={{
              width: i % 4 === 0 ? 220 : 6,
              height: i % 4 === 0 ? 220 : 6,
              left: `${(i * 13) % 100}%`,
              top: `${(i * 19) % 100}%`,
              background: i % 4 === 0
                ? 'radial-gradient(circle, rgba(0, 217, 255, 0.08) 0%, transparent 70%)'
                : 'rgba(0, 217, 255, 0.24)',
              filter: i % 4 === 0 ? 'blur(12px)' : 'none',
            }}
            animate={{
              y: [0, -24, 0],
              x: [0, i % 2 === 0 ? 12 : -12, 0],
              opacity: [0.15, 0.4, 0.15],
            }}
            transition={{
              duration: 7 + (i % 5),
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.12,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <motion.div
        className="relative z-10 px-12 py-8 border-b border-border/30"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-7xl mx-auto flex items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full glass-panel px-4 py-2 text-xs uppercase tracking-[0.24em] text-cyan-glow/80">
              <Sparkles size={14} />
              Discord CRM Directory
            </div>
            <h1 className="text-4xl tracking-tight mt-5 mb-2">People Directory</h1>
            <p className="max-w-2xl text-silver-soft/70">
              Browse the living archive of your Discord community with live profile memory, activity signals, and people context.
            </p>
          </div>

          <button
            onClick={loadPeople}
            className="glass-panel glass-glow inline-flex items-center gap-3 px-5 py-3 text-silver-soft hover:text-cyan-glow transition-colors"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-8 max-w-7xl mx-auto">
          <div className="glass-panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Users className="text-cyan-glow" size={22} />
              <span className="text-xs text-silver-soft/50">Live</span>
            </div>
            <div className="text-3xl">{people.length}</div>
            <div className="text-sm text-silver-soft/60">Tracked people</div>
          </div>
          <div className="glass-panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Brain className="text-violet-smoke" size={22} />
              <span className="text-xs text-silver-soft/50">Knowledge</span>
            </div>
            <div className="text-3xl">{totalFacts}</div>
            <div className="text-sm text-silver-soft/60">Remembered facts</div>
          </div>
          <div className="glass-panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <TrendingUp className="text-warm-accent" size={22} />
              <span className="text-xs text-silver-soft/50">72h</span>
            </div>
            <div className="text-3xl">{activePeopleCount}</div>
            <div className="text-sm text-silver-soft/60">Recently active</div>
          </div>
          <div className="glass-panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Sparkles className="text-electric-blue" size={22} />
              <span className="text-xs text-silver-soft/50">Messages</span>
            </div>
            <div className="text-3xl">{messageTotal}</div>
            <div className="text-sm text-silver-soft/60">Tracked messages</div>
          </div>
        </div>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        className="relative z-10 px-12 py-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-silver-soft/40" size={20} />
            <input
              type="text"
              placeholder="Search people, channels, servers, or recent messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full glass-panel px-12 py-4 bg-input-background text-foreground placeholder:text-silver-soft/40 outline-none focus:ring-2 ring-cyan-glow/50 transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <motion.button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-4 py-3 rounded-full transition-all ${
                  activeFilter === filter.id
                    ? 'glass-panel glass-glow text-cyan-glow'
                    : 'glass-panel text-silver-soft/60 hover:text-silver-soft'
                }`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                {filter.label} <span className="opacity-60">({filter.count})</span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Floating People Constellation */}
      <div className="relative px-12 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          {error && (
            <div className="glass-panel p-5 text-sm text-red-300">{error}</div>
          )}

          {!error && loading && (
            <div className="glass-panel p-8 text-silver-soft/70">Loading live people directory...</div>
          )}

          {!loading && !error && (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-6">
                <motion.button
                  type="button"
                  onClick={() => spotlightPerson && navigate(`/person/${spotlightPerson.userId}`)}
                  className="glass-panel glass-glow p-8 text-left relative overflow-hidden"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(0,217,255,0.16),transparent_72%)]" />
                  <div className="relative z-10 flex flex-col md:flex-row md:items-end gap-6">
                    <div className="relative shrink-0">
                      <div className="w-28 h-28 rounded-[2rem] glass-panel overflow-hidden flex items-center justify-center text-3xl text-white/90">
                        {spotlightPerson?.avatarUrl ? (
                          <img src={spotlightPerson.avatarUrl} alt={spotlightPerson.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span>{spotlightPerson ? getInitials(spotlightPerson) : 'U'}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 space-y-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-cyan-glow/75">Directory spotlight</div>
                        <div className="text-3xl mt-2">{spotlightPerson?.displayName || 'No profiles yet'}</div>
                        <div className="text-silver-soft/60 mt-2">
                          @{spotlightPerson?.username || 'unknown'} • last active {spotlightPerson ? formatRelativeTime(spotlightPerson.lastSeenAt) : 'never'}
                        </div>
                      </div>

                      <p className="max-w-2xl text-silver-soft/75 leading-7">
                        {spotlightPerson?.lastMessage || 'As people start talking in Discord, their latest message, knowledge, and activity will appear here automatically.'}
                      </p>

                      <div className="flex flex-wrap gap-3 text-sm">
                        <div className="glass-panel px-4 py-2 text-silver-soft/80">{spotlightPerson?.messageCount || 0} messages</div>
                        <div className="glass-panel px-4 py-2 text-silver-soft/80">{spotlightPerson?.factCount || 0} remembered facts</div>
                        <div className="glass-panel px-4 py-2 text-silver-soft/80">#{spotlightPerson?.lastChannel || 'unknown'}</div>
                        <div className="glass-panel px-4 py-2 text-silver-soft/80">{spotlightPerson?.lastServer || 'DM'}</div>
                      </div>
                    </div>

                    <div className="shrink-0 inline-flex items-center gap-2 text-cyan-glow">
                      Open profile
                      <ArrowUpRight size={18} />
                    </div>
                  </div>
                </motion.button>

                <motion.div
                  className="space-y-6"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <div className="glass-panel p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-lg">Recently seen</div>
                        <div className="text-sm text-silver-soft/60">Latest activity across your tracked community</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {recentPeople.map((person) => (
                        <button
                          key={person.userId}
                          onClick={() => navigate(`/person/${person.userId}`)}
                          className="w-full glass-panel p-3 flex items-center gap-3 text-left hover:glass-glow transition-all"
                        >
                          <div className="w-11 h-11 rounded-2xl overflow-hidden glass-panel flex items-center justify-center text-sm text-white/90 shrink-0">
                            {person.avatarUrl ? (
                              <img src={person.avatarUrl} alt={person.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <span>{getInitials(person)}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{person.displayName}</div>
                            <div className="truncate text-xs text-silver-soft/60">#{person.lastChannel} • {person.lastServer}</div>
                          </div>
                          <div className="text-xs text-silver-soft/60">{formatRelativeTime(person.lastSeenAt)}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel p-5">
                    <div className="text-lg">Strongest memory signals</div>
                    <div className="text-sm text-silver-soft/60 mt-1 mb-4">Profiles with the richest knowledge history</div>
                    <div className="space-y-3">
                      {strongestProfiles.map((person, index) => (
                        <div key={person.userId} className="glass-panel p-3 flex items-center gap-3">
                          <div className="text-cyan-glow/65 text-sm w-6">#{index + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{person.displayName}</div>
                            <div className="text-xs text-silver-soft/60 truncate">@{person.username}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-cyan-glow">{person.factCount}</div>
                            <div className="text-[11px] text-silver-soft/55">facts</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
                {filteredPeople.map((person, index) => (
                  <motion.button
                    key={person.userId}
                    type="button"
                    className={`relative group overflow-hidden rounded-[28px] glass-panel p-6 text-left ${index % 5 === 0 ? '2xl:col-span-2' : ''}`}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.04 * index }}
                    whileHover={{ scale: 1.015, y: -4 }}
                    onClick={() => navigate(`/person/${person.userId}`)}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_top_right,rgba(0,217,255,0.14),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(139,122,255,0.10),transparent_35%)]" />

                    <div className="relative z-10 flex flex-col h-full gap-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-16 h-16 rounded-[22px] overflow-hidden glass-panel flex items-center justify-center text-lg text-white/90 shrink-0">
                            {person.avatarUrl ? (
                              <img src={person.avatarUrl} alt={person.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <span>{getInitials(person)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xl">{person.displayName}</div>
                            <div className="truncate text-sm text-silver-soft/60">@{person.username}</div>
                          </div>
                        </div>

                        <div className={`w-3 h-3 rounded-full ${isRecent(person.lastSeenAt, 24) ? 'bg-emerald-400' : 'bg-silver-soft/30'}`} />
                      </div>

                      <p className="text-sm leading-7 text-silver-soft/72 min-h-[56px]">
                        {person.lastMessage || 'No recent message stored yet.'}
                      </p>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="glass-panel px-3 py-2 text-cyan-glow/85">{person.messageCount} messages</span>
                        <span className="glass-panel px-3 py-2 text-violet-smoke">{person.factCount} facts</span>
                        <span className="glass-panel px-3 py-2 text-silver-soft/75">{person.lastServer || 'DM'}</span>
                      </div>

                      <div className="mt-auto flex items-center justify-between text-sm text-silver-soft/60 gap-4">
                        <span className="truncate">#{person.lastChannel || 'unknown'}</span>
                        <span className="shrink-0">{formatRelativeTime(person.lastSeenAt)}</span>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              {!filteredPeople.length && (
                <div className="glass-panel p-8 text-silver-soft/70">
                  No people matched your current filters.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
