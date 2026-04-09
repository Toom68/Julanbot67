import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Brain, Clock3, Layers3, RefreshCw, Search, User } from 'lucide-react';
import { fetchJulianScans, type JulianScanRun } from '../lib/api';

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

export function JulianScans() {
  const [scans, setScans] = useState<JulianScanRun[]>([]);
  const [selectedScanId, setSelectedScanId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadScans = async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchJulianScans();
      const nextScans = payload.scans || [];
      setScans(nextScans);
      setSelectedScanId((current) => current || nextScans[0]?.scanId || '');
    } catch (loadError) {
      console.error(loadError);
      setError('Unable to load Julian scan history right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScans();
  }, []);

  const selectedScan = useMemo(
    () => scans.find((scan) => scan.scanId === selectedScanId) || scans[0] || null,
    [scans, selectedScanId]
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
              <Search size={14} />
              Julian Scan History
            </div>
            <h1 className="text-4xl tracking-tight mt-5 mb-2">Julian Scans</h1>
            <p className="max-w-3xl text-silver-soft/70">
              Review every `/julian` run, who triggered it, which messages were scanned, and how the captured messages clustered into conversation threads.
            </p>
          </div>

          <button
            onClick={loadScans}
            className="glass-panel glass-glow inline-flex items-center gap-3 px-5 py-3 text-silver-soft hover:text-cyan-glow transition-colors"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </motion.div>

      <div className="px-12 py-8 max-w-7xl mx-auto">
        {error && <div className="glass-panel p-5 text-sm text-red-300 mb-6">{error}</div>}
        {loading && !error && <div className="glass-panel p-8 text-silver-soft/70">Loading Julian scan history...</div>}

        {!loading && !error && !scans.length && (
          <div className="glass-panel p-8 text-silver-soft/70">No `/julian` scans have been recorded yet.</div>
        )}

        {!loading && !error && selectedScan && (
          <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.25fr] gap-8">
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              {scans.map((scan) => {
                const isActive = scan.scanId === selectedScan.scanId;

                return (
                  <button
                    key={scan.scanId}
                    type="button"
                    onClick={() => setSelectedScanId(scan.scanId)}
                    className={`w-full text-left glass-panel p-5 transition-all ${isActive ? 'glass-glow border border-cyan-glow/40' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="text-lg">{scan.server} • #{scan.channel}</div>
                        <div className="text-sm text-silver-soft/60 mt-1">{formatDateTime(scan.triggeredAt)}</div>
                      </div>
                      <div className="text-xs glass-panel px-3 py-2 text-cyan-glow">{scan.totalMessages} msgs</div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-silver-soft/70">
                      <span className="glass-panel px-3 py-2 inline-flex items-center gap-2"><User size={12} /> {scan.triggeredByUsername}</span>
                      <span className="glass-panel px-3 py-2 inline-flex items-center gap-2"><Brain size={12} /> {scan.totalFactsAdded} facts</span>
                      <span className="glass-panel px-3 py-2 inline-flex items-center gap-2"><Layers3 size={12} /> {scan.threads.length} threads</span>
                    </div>
                  </button>
                );
              })}
            </motion.div>

            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="glass-panel p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="text-2xl">{selectedScan.server} • #{selectedScan.channel}</div>
                    <div className="text-sm text-silver-soft/60 mt-2">Triggered by @{selectedScan.triggeredByUsername} on {formatDateTime(selectedScan.triggeredAt)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="glass-panel px-3 py-2 text-cyan-glow">{selectedScan.totalMessages} messages</span>
                    <span className="glass-panel px-3 py-2 text-violet-smoke">{selectedScan.totalFactsAdded} facts added</span>
                    <span className="glass-panel px-3 py-2 text-silver-soft/75">{selectedScan.threads.length} threads</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedScan.threads.map((thread) => (
                    <div key={thread.threadId} className="glass-panel p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-lg">{thread.title || 'Conversation thread'}</div>
                          <div className="text-sm text-silver-soft/60 mt-1">{thread.participants.join(', ') || 'Unknown participants'}</div>
                        </div>
                        <div className="text-xs glass-panel px-3 py-2 text-cyan-glow">{thread.messageCount} messages</div>
                      </div>
                      <div className="text-xs text-silver-soft/55 inline-flex items-center gap-2">
                        <Clock3 size={12} />
                        {formatDateTime(thread.startedAt)} - {formatDateTime(thread.endedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-6">
                <div className="flex items-center gap-3 mb-5 border-b border-border/30 pb-4">
                  <Search className="text-cyan-glow" size={22} />
                  <h2 className="text-2xl">Collected Messages</h2>
                </div>

                <div className="space-y-4 max-h-[920px] overflow-auto pr-2">
                  {selectedScan.messages.map((message) => (
                    <div key={message.messageId} className="glass-panel p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-foreground">@{message.authorUsername}</div>
                          <div className="text-xs text-silver-soft/60 mt-1">{formatDateTime(message.timestamp)}</div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {message.threadId && (
                            <span className="glass-panel px-3 py-2 text-cyan-glow">{message.threadMessageCount} in thread</span>
                          )}
                          <span className="glass-panel px-3 py-2 text-violet-smoke">{message.factsAdded} facts added</span>
                        </div>
                      </div>

                      <div className="text-silver-soft/80 leading-7">{message.message || 'No message text.'}</div>

                      {(message.images.length + message.videos.length + message.gifs.length) > 0 && (
                        <div className="text-xs text-silver-soft/60">
                          {message.images.length} images • {message.videos.length} videos • {message.gifs.length} GIFs
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
