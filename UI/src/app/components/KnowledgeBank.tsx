import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Brain, Search, Filter, Tag, Briefcase, GraduationCap, Heart, Settings, MapPin } from 'lucide-react';
import { fetchKnowledge, fetchPeople, type KnowledgeEntry, type PersonSummary } from '../lib/api';

const categories = [
  { id: 'all', label: 'All Facts', icon: Brain },
  { id: 'identity', label: 'Identity', icon: Tag },
  { id: 'profile', label: 'Profile', icon: Tag },
  { id: 'work', label: 'Work', icon: Briefcase },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'preference', label: 'Preferences', icon: Heart },
  { id: 'project', label: 'Projects', icon: Settings },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'contact', label: 'Contact', icon: Tag },
  { id: 'tooling', label: 'Tooling', icon: Settings },
];

export function KnowledgeBank() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'person' | 'recent'>('recent');
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        const [knowledgePayload, peoplePayload] = await Promise.all([
          fetchKnowledge(),
          fetchPeople(),
        ]);

        setKnowledge(knowledgePayload.knowledge || []);
        setPeople(peoplePayload.people || []);
      } catch (loadError) {
        console.error(loadError);
        setError('Unable to load live knowledge right now.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const peopleByUserId = useMemo(
    () => new Map(people.map((person) => [person.userId, person])),
    [people]
  );

  const filteredFacts = useMemo(() => {
    const query = searchQuery.toLowerCase();

    const nextFacts = knowledge.filter((fact) => {
      const person = peopleByUserId.get(fact.userId);
      const displayName = person?.displayName || fact.username;
      const matchesSearch =
        fact.fact.toLowerCase().includes(query) ||
        displayName.toLowerCase().includes(query) ||
        fact.username.toLowerCase().includes(query);

      const matchesCategory = activeCategory === 'all' || fact.category === activeCategory;

      return matchesSearch && matchesCategory;
    });

    if (sortBy === 'person') {
      return [...nextFacts].sort((a, b) => {
        const leftName = peopleByUserId.get(a.userId)?.displayName || a.username;
        const rightName = peopleByUserId.get(b.userId)?.displayName || b.username;
        return leftName.localeCompare(rightName);
      });
    }

    return [...nextFacts].sort(
      (a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime()
    );
  }, [activeCategory, knowledge, peopleByUserId, searchQuery, sortBy]);

  return (
    <div className="w-full h-full overflow-auto">
      {/* Header */}
      <motion.div
        className="px-12 py-8 border-b border-border/30"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-4xl tracking-tight mb-2">Knowledge Bank</h1>
        <p className="text-silver-soft/70">A refined archive of remembered facts and insights</p>
      </motion.div>

      {/* Search and Controls */}
      <motion.div
        className="px-12 py-6 border-b border-border/30"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-silver-soft/40" size={20} />
            <input
              type="text"
              placeholder="Search facts or people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full glass-panel px-12 py-3 bg-input-background text-foreground placeholder:text-silver-soft/40 outline-none focus:ring-2 ring-cyan-glow/50 transition-all"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 glass-panel px-4 py-3">
            <Filter size={18} className="text-silver-soft/60" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'person' | 'recent')}
              className="bg-transparent text-foreground outline-none cursor-pointer"
            >
              <option value="recent">Most Recent</option>
              <option value="person">Person A-Z</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Category Filters */}
      <motion.div
        className="px-12 py-6 border-b border-border/30"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap gap-2">
          {categories.map((category) => {
            const Icon = category.icon;
            const count =
              category.id === 'all'
                ? knowledge.length
                : knowledge.filter((f) => f.category === category.id).length;

            return (
              <motion.button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeCategory === category.id
                    ? 'glass-panel glass-glow text-cyan-glow'
                    : 'glass-panel text-silver-soft/60 hover:text-silver-soft'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Icon size={16} />
                {category.label}
                <span className="opacity-60">({count})</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Facts Grid */}
      <div className="px-12 py-8">
        <div className="max-w-7xl mx-auto">
          {error && (
            <div className="glass-panel p-6 text-red-300 mb-6">{error}</div>
          )}

          {loading && !error && (
            <div className="glass-panel p-6 text-silver-soft/70 mb-6">Loading live knowledge...</div>
          )}

          <div className="grid grid-cols-2 gap-6">
            {filteredFacts.map((fact, index) => {
              const categoryInfo = categories.find((c) => c.id === fact.category);
              const Icon = categoryInfo?.icon || Brain;
              const person = peopleByUserId.get(fact.userId);
              const displayName = person?.displayName || fact.username;

              return (
                <motion.div
                  key={`${fact.userId}-${fact.category}-${fact.fact}-${index}`}
                  className="glass-panel p-6 space-y-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                >
                  {/* Category badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm glass-panel px-3 py-1">
                      <Icon size={14} className="text-cyan-glow" />
                      <span className="capitalize text-silver-soft/80">{fact.category}</span>
                    </div>
                    <div className="glass-panel px-2 py-1 text-sm text-cyan-glow">
                      {new Date(fact.observedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Content */}
                  <p className="text-foreground leading-relaxed">{fact.fact}</p>

                  {/* Metadata */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg overflow-hidden glass-panel flex items-center justify-center text-sm text-white/90">
                        {person?.avatarUrl ? (
                          <img src={person.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                        ) : (
                          displayName.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-foreground">{displayName}</div>
                        <div className="text-xs text-silver-soft/60">Source: {fact.server || 'DM'} • #{fact.channel || 'unknown'}</div>
                      </div>
                    </div>
                    <div className="text-xs text-silver-soft/60">
                      @{fact.username}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filteredFacts.length === 0 && (
            <motion.div
              className="text-center py-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Brain className="mx-auto mb-4 text-silver-soft/40" size={48} />
              <h3 className="text-xl text-silver-soft/70 mb-2">No facts found</h3>
              <p className="text-silver-soft/50">Try adjusting your search or filters</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
