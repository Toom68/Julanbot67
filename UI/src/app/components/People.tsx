import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { ArrowUpRight, Clock3, RefreshCw, Search, Users } from 'lucide-react';
import { fetchMessages, fetchPeople, type PersonSummary } from '../lib/api';

function normalizeHandle(value: string) {
  return value.trim().toLowerCase();
}

function createLegacyPersonId(username: string) {
  return `message-log:${normalizeHandle(username)}`;
}

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

export function People() {
  const navigate = useNavigate();
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadPeople = async () => {
    try {
      setLoading(true);
      setError('');
      setNotice('');
      const [peopleResult, messagesResult] = await Promise.allSettled([
        fetchPeople(),
        fetchMessages(),
      ]);

      if (peopleResult.status === 'rejected' && messagesResult.status === 'rejected') {
        throw new Error('Failed to load people and messages');
      }

      const apiPeople = peopleResult.status === 'fulfilled'
        ? [...(peopleResult.value.people || [])]
        : [];
      const dashboardMessages = messagesResult.status === 'fulfilled'
        ? (messagesResult.value.messages || [])
        : [];

      if (peopleResult.status === 'rejected') {
        console.error(peopleResult.reason);
        setNotice('Live people sync is unavailable right now. Showing message history only.');
      }

      if (messagesResult.status === 'rejected') {
        console.error(messagesResult.reason);
        setNotice((currentNotice) => currentNotice || 'Recent message history is unavailable right now.');
      }

      const peopleByHandle = new Map<string, PersonSummary>();

      apiPeople.forEach((person) => {
        const handles = [person.username, person.displayName]
          .map((value) => normalizeHandle(value || ''))
          .filter(Boolean);

        handles.forEach((handle) => {
          if (!peopleByHandle.has(handle)) {
            peopleByHandle.set(handle, person);
          }
        });
      });

      for (const message of dashboardMessages) {
        const senderHandle = normalizeHandle(message.sender || '');

        if (!senderHandle || peopleByHandle.has(senderHandle)) {
          continue;
        }

        const fallbackPerson: PersonSummary = {
          userId: createLegacyPersonId(message.sender),
          username: message.sender,
          displayName: message.sender,
          avatarUrl: '',
          firstSeenAt: message.timestamp,
          lastSeenAt: message.timestamp,
          lastMessage: message.message || '',
          messageCount: 1,
          factCount: 0,
          lastChannel: '',
          lastServer: '',
        };

        apiPeople.push(fallbackPerson);
        peopleByHandle.set(senderHandle, fallbackPerson);
      }

      setPeople(apiPeople);
    } catch (loadError) {
      console.error(loadError);
      setError('Unable to load the people list right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeople();
  }, []);

  const filteredPeople = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sortedPeople = [...people].sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));

    return sortedPeople.filter((person) => {
      if (!query) {
        return true;
      }

      return [
        person.displayName,
        person.username,
        person.lastServer,
        person.lastChannel,
        person.lastMessage,
      ].some((value) => (value || '').toLowerCase().includes(query));
    });
  }, [people, searchQuery]);

  const activeCount = useMemo(
    () => people.filter((person) => isRecent(person.lastSeenAt, 72)).length,
    [people]
  );

  return (
    <div className="w-full h-full overflow-auto">
      <motion.div
        className="px-12 py-8 border-b border-border/30"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full glass-panel px-4 py-2 text-xs uppercase tracking-[0.24em] text-cyan-glow/80">
              <Users size={14} />
              Server People
            </div>
            <h1 className="text-4xl tracking-tight mt-5 mb-2">People</h1>
            <p className="max-w-2xl text-silver-soft/70">
              A clean list of tracked community members, historical message-only profiles, and live server members.
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-7xl mx-auto">
          <div className="glass-panel p-5 space-y-2">
            <div className="text-sm text-silver-soft/60">Total profiles</div>
            <div className="text-3xl">{people.length}</div>
          </div>
          <div className="glass-panel p-5 space-y-2">
            <div className="text-sm text-silver-soft/60">Recently active</div>
            <div className="text-3xl">{activeCount}</div>
          </div>
          <div className="glass-panel p-5 space-y-2">
            <div className="text-sm text-silver-soft/60">Profiles with memory</div>
            <div className="text-3xl">{people.filter((person) => person.factCount > 0).length}</div>
          </div>
        </div>
      </motion.div>

      <div className="px-12 py-8 max-w-7xl mx-auto space-y-6">
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-silver-soft/40" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name, username, server, channel, or latest message..."
            className="w-full glass-panel px-12 py-4 bg-input-background text-foreground placeholder:text-silver-soft/40 outline-none focus:ring-2 ring-cyan-glow/50 transition-all"
          />
        </motion.div>

        {error && <div className="glass-panel p-5 text-sm text-red-300">{error}</div>}

        {!error && notice && <div className="glass-panel p-5 text-sm text-amber-200">{notice}</div>}

        {!error && loading && <div className="glass-panel p-8 text-silver-soft/70">Loading people list...</div>}

        {!loading && !error && (
          <motion.div
            className="glass-panel overflow-hidden"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
          >
            <div className="grid grid-cols-[minmax(0,2.3fr)_120px_120px_180px_56px] gap-4 px-6 py-4 text-xs uppercase tracking-[0.18em] text-silver-soft/45 border-b border-border/30">
              <div>Person</div>
              <div>Messages</div>
              <div>Facts</div>
              <div>Last seen</div>
              <div />
            </div>

            <div className="divide-y divide-border/20">
              {filteredPeople.map((person) => (
                <button
                  key={person.userId}
                  type="button"
                  onClick={() => navigate(`/person/${person.userId}`)}
                  className="w-full grid grid-cols-[minmax(0,2.3fr)_120px_120px_180px_56px] gap-4 px-6 py-5 text-left hover:bg-white/[0.025] transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden glass-panel flex items-center justify-center text-sm text-white/90 shrink-0">
                      {person.avatarUrl ? (
                        <img src={person.avatarUrl} alt={person.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span>{getInitials(person)}</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="truncate text-lg">{person.displayName}</div>
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isRecent(person.lastSeenAt, 24) ? 'bg-emerald-400' : 'bg-silver-soft/25'}`} />
                      </div>
                      <div className="truncate text-sm text-silver-soft/60">@{person.username}</div>
                      <div className="truncate text-xs text-silver-soft/45 mt-1">{person.lastServer || 'DM'} • #{person.lastChannel || 'unknown'}</div>
                    </div>
                  </div>

                  <div className="self-center text-cyan-glow">{person.messageCount}</div>
                  <div className="self-center text-violet-smoke">{person.factCount}</div>

                  <div className="self-center text-sm text-silver-soft/65 inline-flex items-center gap-2">
                    <Clock3 size={14} />
                    {formatRelativeTime(person.lastSeenAt)}
                  </div>

                  <div className="self-center justify-self-end text-cyan-glow">
                    <ArrowUpRight size={18} />
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {!loading && !error && !filteredPeople.length && (
          <div className="glass-panel p-8 text-silver-soft/70">No people matched your current search.</div>
        )}
      </div>
    </div>
  );
}
