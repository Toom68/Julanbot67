import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Activity as ActivityIcon, MessageSquare, Image as ImageIcon, Calendar, Video, Layers3 } from 'lucide-react';
import { fetchMessages, fetchPeople, type ConversationThread, type DashboardMessage, type PersonSummary } from '../lib/api';

type ViewMode = 'all' | 'messages' | 'media';

type MediaItem = {
  id: string;
  type: 'image' | 'video' | 'gif';
  url: string;
  sender: string;
  timestamp: string;
};

function passesDateFilter(timestamp: string, filter: string) {
  if (filter === 'all') {
    return true;
  }

  const value = new Date(timestamp).getTime();

  if (Number.isNaN(value)) {
    return filter === 'all';
  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  if (filter === 'today') {
    return now - value <= day;
  }

  if (filter === 'week') {
    return now - value <= day * 7;
  }

  if (filter === 'month') {
    return now - value <= day * 30;
  }

  return true;
}

export function Activity() {
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filters = [
    { id: 'all', label: 'All Activity', icon: ActivityIcon },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'media', label: 'Media', icon: ImageIcon },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        const [messagesPayload, peoplePayload] = await Promise.all([
          fetchMessages(),
          fetchPeople(),
        ]);

        setMessages(messagesPayload.messages || []);
        setThreads(messagesPayload.threads || []);
        setPeople(peoplePayload.people || []);
      } catch (loadError) {
        console.error(loadError);
        setError('Unable to load live activity right now.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const peopleByUsername = useMemo(
    () => new Map(people.map((person) => [person.username, person])),
    [people]
  );

  const filteredMessages = useMemo(
    () => messages.filter((message) => passesDateFilter(message.timestamp, dateFilter)),
    [dateFilter, messages]
  );

  const filteredThreads = useMemo(
    () => threads.filter((thread) => thread.messages.some((message) => passesDateFilter(message.timestamp, dateFilter))),
    [dateFilter, threads]
  );

  const mediaItems = useMemo(() => {
    const items: MediaItem[] = [];

    filteredMessages.forEach((message, messageIndex) => {
      message.images.forEach((url, index) => {
        items.push({
          id: `image-${messageIndex}-${index}`,
          type: 'image',
          url,
          sender: message.sender,
          timestamp: message.timestamp,
        });
      });

      message.videos.forEach((url, index) => {
        items.push({
          id: `video-${messageIndex}-${index}`,
          type: 'video',
          url,
          sender: message.sender,
          timestamp: message.timestamp,
        });
      });

      message.gifs.forEach((url, index) => {
        items.push({
          id: `gif-${messageIndex}-${index}`,
          type: 'gif',
          url,
          sender: message.sender,
          timestamp: message.timestamp,
        });
      });
    });

    return items;
  }, [filteredMessages]);

  return (
    <div className="w-full h-full overflow-auto">
      {/* Header */}
      <motion.div
        className="px-12 py-8 border-b border-border/30"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-4xl tracking-tight mb-2">Activity Feed</h1>
        <p className="text-silver-soft/70">Browse Discord messages and media in a curated archive</p>
      </motion.div>

      {/* Filters */}
      <motion.div
        className="px-12 py-6 border-b border-border/30"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          {/* View mode */}
          <div className="flex gap-2">
            {filters.map((filter) => {
              const Icon = filter.icon;
              return (
                <motion.button
                  key={filter.id}
                  onClick={() => setViewMode(filter.id as ViewMode)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    viewMode === filter.id
                      ? 'glass-panel glass-glow text-cyan-glow'
                      : 'glass-panel text-silver-soft/60 hover:text-silver-soft'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon size={18} />
                  {filter.label}
                </motion.button>
              );
            })}
          </div>

          {/* Date filter */}
          <div className="flex items-center gap-2 glass-panel px-4 py-2 ml-auto">
            <Calendar size={18} className="text-silver-soft/60" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent text-foreground outline-none cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="px-12 py-8">
        <div className="max-w-5xl mx-auto">
          {error && (
            <div className="glass-panel p-6 text-red-300 mb-6">{error}</div>
          )}

          {loading && !error && (
            <div className="glass-panel p-6 text-silver-soft/70 mb-6">Loading live activity...</div>
          )}

          {!loading && (viewMode === 'all' || viewMode === 'messages') && (
            <div className="space-y-6 mb-12">
              <div className="flex items-center gap-3 mb-6">
                <Layers3 className="text-violet-smoke" size={24} />
                <h2 className="text-2xl">Conversation Threads</h2>
              </div>

              <div className="space-y-4">
                {filteredThreads.map((thread, index) => (
                  <motion.div
                    key={thread.threadId}
                    className="glass-panel p-6"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="text-xl text-foreground">{thread.title || 'Conversation thread'}</div>
                        <div className="text-sm text-silver-soft/60 mt-2">
                          {thread.participants.join(', ') || 'Unknown participants'}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="glass-panel px-3 py-2 text-cyan-glow">{thread.messageCount} messages</span>
                        <span className="glass-panel px-3 py-2 text-silver-soft/70">
                          {new Date(thread.startedAt).toLocaleString()} - {new Date(thread.endedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {thread.messages.slice(0, 4).map((message, messageIndex) => {
                        const person = peopleByUsername.get(message.sender);

                        return (
                          <div key={`${thread.threadId}-${message.timestamp}-${messageIndex}`} className="glass-panel p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl overflow-hidden glass-panel flex items-center justify-center flex-shrink-0 text-white/90">
                                {person?.avatarUrl ? (
                                  <img src={person.avatarUrl} alt={person.displayName} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-sm">{(person?.displayName || message.sender).charAt(0)}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-baseline gap-3 mb-2">
                                  <span className="font-medium text-foreground">{person?.displayName || message.sender}</span>
                                  <span className="text-xs text-silver-soft/60">{new Date(message.timestamp).toLocaleString()}</span>
                                </div>
                                <div className="text-silver-soft/80 leading-relaxed">{message.message || 'No message text.'}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}

                {!filteredThreads.length && (
                  <div className="glass-panel p-6 text-silver-soft/70">No conversation threads match the current date filter.</div>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          {!loading && (viewMode === 'all' || viewMode === 'messages') && (
            <div className="space-y-6 mb-12">
              <div className="flex items-center gap-3 mb-6">
                <MessageSquare className="text-cyan-glow" size={24} />
                <h2 className="text-2xl">Recent Messages</h2>
              </div>

              <div className="space-y-4">
                {filteredMessages.map((message, index) => {
                  const person = peopleByUsername.get(message.sender);
                  const attachmentCount = message.images.length + message.videos.length + message.gifs.length;

                  return (
                  <motion.div
                    key={`${message.timestamp}-${message.sender}-${index}`}
                    className="glass-panel p-6"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    whileHover={{ scale: 1.01 }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden glass-panel flex items-center justify-center flex-shrink-0 text-white/90">
                        {person?.avatarUrl ? (
                          <img src={person.avatarUrl} alt={person.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg">{(person?.displayName || message.sender).charAt(0)}</span>
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-baseline gap-3">
                          <span className="font-medium text-foreground">{person?.displayName || message.sender}</span>
                          <span className="text-sm text-silver-soft/60">
                            {new Date(message.timestamp).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-foreground leading-relaxed">{message.message || 'No message text.'}</p>

                        <div className="flex items-center gap-4 text-xs text-silver-soft/60 pt-2">
                          <span>@{message.sender}</span>
                          {attachmentCount > 0 && (
                            <span className="flex items-center gap-1 text-cyan-glow">
                              <ImageIcon size={12} />
                              {attachmentCount} attachment{attachmentCount === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  );
                })}

                {!filteredMessages.length && (
                  <div className="glass-panel p-6 text-silver-soft/70">No messages match the current date filter.</div>
                )}
              </div>
            </div>
          )}

          {/* Media Gallery */}
          {!loading && (viewMode === 'all' || viewMode === 'media') && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <ImageIcon className="text-violet-smoke" size={24} />
                <h2 className="text-2xl">Shared Media</h2>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {mediaItems.map((media, index) => {
                  const person = peopleByUsername.get(media.sender);
                  const MediaTypeIcon = media.type === 'video' ? Video : ImageIcon;

                  return (
                  <motion.a
                    key={media.id}
                    href={media.url}
                    target="_blank"
                    rel="noreferrer"
                    className="glass-panel overflow-hidden group cursor-pointer"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="aspect-video w-full bg-[radial-gradient(circle_at_top,rgba(0,217,255,0.18),rgba(15,18,35,0.95))] overflow-hidden flex items-center justify-center">
                      {media.type === 'image' || media.type === 'gif' ? (
                        <img src={media.url} alt={media.type} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-silver-soft/80">
                          <MediaTypeIcon size={32} className="text-cyan-glow" />
                          <span className="text-sm uppercase tracking-[0.22em]">{media.type}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded overflow-hidden glass-panel flex items-center justify-center text-xs text-white/90">
                          {person?.avatarUrl ? (
                            <img src={person.avatarUrl} alt={person.displayName} className="w-full h-full object-cover" />
                          ) : (
                            (person?.displayName || media.sender).charAt(0)
                          )}
                        </div>
                        <span className="text-sm text-foreground">{person?.displayName || media.sender}</span>
                      </div>
                      <div className="text-xs text-silver-soft/60">
                        {media.type.toUpperCase()} • {new Date(media.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </motion.a>
                  );
                })}

                {!mediaItems.length && (
                  <div className="glass-panel p-6 text-silver-soft/70 col-span-3">No media found for the selected date range.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
