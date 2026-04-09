import { useState } from 'react';
import { motion } from 'motion/react';
import { Settings as SettingsIcon, Server, Hash, Database, Eye, Image, Shield, Activity } from 'lucide-react';

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  description?: string;
}

function Toggle({ enabled, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex-1">
        <div className="text-foreground mb-1">{label}</div>
        {description && <div className="text-sm text-silver-soft/60">{description}</div>}
      </div>
      <motion.button
        className={`relative w-12 h-6 rounded-full transition-colors ${
          enabled ? 'bg-cyan-glow' : 'bg-steel-blue/30'
        }`}
        onClick={() => onChange(!enabled)}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg"
          animate={{ x: enabled ? 28 : 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </motion.button>
    </div>
  );
}

export function Settings() {
  const [messageLogging, setMessageLogging] = useState(true);
  const [mediaCapture, setMediaCapture] = useState(true);
  const [knowledgeExtraction, setKnowledgeExtraction] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);

  const [selectedTab, setSelectedTab] = useState<'tracking' | 'extraction' | 'privacy' | 'system'>('tracking');

  const tabs = [
    { id: 'tracking', label: 'Tracking', icon: Server },
    { id: 'extraction', label: 'Extraction', icon: Database },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'system', label: 'System', icon: Activity },
  ];

  return (
    <div className="w-full h-full overflow-auto">
      {/* Header */}
      <motion.div
        className="px-12 py-8 border-b border-border/30"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-4xl tracking-tight mb-2">Settings</h1>
        <p className="text-silver-soft/70">Configure your Discord CRM preferences</p>
      </motion.div>

      {/* Content */}
      <div className="px-12 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Tab Navigation */}
          <motion.div
            className="flex gap-2 mb-8"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all ${
                    selectedTab === tab.id
                      ? 'glass-panel glass-glow text-cyan-glow'
                      : 'glass-panel text-silver-soft/60 hover:text-silver-soft'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon size={18} />
                  {tab.label}
                </motion.button>
              );
            })}
          </motion.div>

          {/* Settings Content */}
          <motion.div
            key={selectedTab}
            className="glass-panel p-8"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Tracking Tab */}
            {selectedTab === 'tracking' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border/30 pb-4">
                  <Server className="text-cyan-glow" size={24} />
                  <h2 className="text-2xl">Tracking Configuration</h2>
                </div>

                <div className="space-y-4">
                  <div className="glass-panel p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Server size={18} className="text-violet-smoke" />
                      <h3 className="text-lg">Tracked Servers</h3>
                    </div>
                    <div className="space-y-2">
                      {['TechCorp', 'Open Source Hub', 'Design Community', 'AI Research'].map((server) => (
                        <div key={server} className="flex items-center justify-between py-2">
                          <span className="text-foreground">{server}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs glass-panel px-2 py-1 text-green-400">Active</span>
                            <button className="text-sm text-silver-soft/60 hover:text-cyan-glow transition-colors">
                              Configure
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="mt-4 glass-panel px-4 py-2 text-cyan-glow hover:glass-glow transition-all w-full">
                      + Add Server
                    </button>
                  </div>

                  <div className="glass-panel p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Hash size={18} className="text-warm-accent" />
                      <h3 className="text-lg">Tracked Channels</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {['#general', '#dev-updates', '#design', '#data-science', '#announcements', '#tech-talk'].map(
                        (channel) => (
                          <div key={channel} className="glass-panel px-3 py-2 text-sm text-silver-soft/80">
                            {channel}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Extraction Tab */}
            {selectedTab === 'extraction' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border/30 pb-4">
                  <Database className="text-cyan-glow" size={24} />
                  <h2 className="text-2xl">Data Extraction</h2>
                </div>

                <div className="space-y-1 divide-y divide-border/20">
                  <Toggle
                    enabled={messageLogging}
                    onChange={setMessageLogging}
                    label="Message Logging"
                    description="Capture and store message content from tracked channels"
                  />
                  <Toggle
                    enabled={mediaCapture}
                    onChange={setMediaCapture}
                    label="Media Capture"
                    description="Save images, videos, and GIFs shared in conversations"
                  />
                  <Toggle
                    enabled={knowledgeExtraction}
                    onChange={setKnowledgeExtraction}
                    label="Knowledge Extraction"
                    description="Automatically extract and categorize facts from messages"
                  />
                  <Toggle
                    enabled={autoSync}
                    onChange={setAutoSync}
                    label="Auto-Sync"
                    description="Continuously sync data in real-time"
                  />
                </div>

                <div className="glass-panel p-6 mt-6">
                  <h3 className="text-lg mb-4">Extraction Categories</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {['Identity', 'Work', 'Education', 'Preferences', 'Projects', 'Location', 'Interests', 'Contact'].map(
                      (category) => (
                        <label key={category} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" defaultChecked className="w-4 h-4" />
                          <span className="text-sm text-foreground">{category}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Tab */}
            {selectedTab === 'privacy' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border/30 pb-4">
                  <Shield className="text-cyan-glow" size={24} />
                  <h2 className="text-2xl">Privacy & Security</h2>
                </div>

                <div className="space-y-1 divide-y divide-border/20">
                  <Toggle
                    enabled={privacyMode}
                    onChange={setPrivacyMode}
                    label="Privacy Mode"
                    description="Anonymize sensitive data and limit data collection"
                  />
                </div>

                <div className="glass-panel p-6">
                  <h3 className="text-lg mb-4 flex items-center gap-2">
                    <Eye size={18} />
                    Data Retention
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-silver-soft/70 mb-2 block">Message Retention Period</label>
                      <select className="w-full glass-panel px-4 py-2 bg-input-background text-foreground outline-none">
                        <option>30 days</option>
                        <option>90 days</option>
                        <option>1 year</option>
                        <option>Forever</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-silver-soft/70 mb-2 block">Media Retention Period</label>
                      <select className="w-full glass-panel px-4 py-2 bg-input-background text-foreground outline-none">
                        <option>30 days</option>
                        <option>90 days</option>
                        <option>1 year</option>
                        <option>Forever</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-6 border-2 border-destructive/30">
                  <h3 className="text-lg mb-2 text-destructive">Danger Zone</h3>
                  <p className="text-sm text-silver-soft/70 mb-4">
                    Irreversible actions that will permanently delete data
                  </p>
                  <div className="flex gap-3">
                    <button className="glass-panel px-4 py-2 text-destructive hover:bg-destructive/10 transition-colors">
                      Clear All Messages
                    </button>
                    <button className="glass-panel px-4 py-2 text-destructive hover:bg-destructive/10 transition-colors">
                      Delete All Data
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* System Tab */}
            {selectedTab === 'system' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border/30 pb-4">
                  <Activity className="text-cyan-glow" size={24} />
                  <h2 className="text-2xl">System Status</h2>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="glass-panel p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg">Bot Status</h3>
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-silver-soft/60">Status</span>
                        <span className="text-green-400">Online</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-silver-soft/60">Uptime</span>
                        <span className="text-foreground">7d 12h 34m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-silver-soft/60">Last Sync</span>
                        <span className="text-foreground">2 minutes ago</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel p-6">
                    <h3 className="text-lg mb-4">Database</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-silver-soft/60">Total Records</span>
                        <span className="text-foreground">4,892</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-silver-soft/60">Storage Used</span>
                        <span className="text-foreground">234 MB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-silver-soft/60">Last Backup</span>
                        <span className="text-foreground">1 hour ago</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-6">
                  <h3 className="text-lg mb-4">System Actions</h3>
                  <div className="flex gap-3">
                    <button className="glass-panel px-4 py-2 text-cyan-glow hover:glass-glow transition-all">
                      Force Sync Now
                    </button>
                    <button className="glass-panel px-4 py-2 text-foreground hover:text-cyan-glow transition-colors">
                      Export Data
                    </button>
                    <button className="glass-panel px-4 py-2 text-foreground hover:text-cyan-glow transition-colors">
                      View Logs
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
