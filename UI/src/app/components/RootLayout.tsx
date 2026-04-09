import { Outlet, Link, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Home, Users, Brain, Activity, Settings as SettingsIcon, BarChart3, Search } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/people', label: 'People', icon: Users },
  { path: '/julian-scans', label: 'Julian Scans', icon: Search },
  { path: '/knowledge', label: 'Knowledge', icon: Brain },
  { path: '/activity', label: 'Activity', icon: Activity },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function RootLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen w-full overflow-hidden film-grain">
      {/* Sidebar Navigation */}
      <motion.nav
        className="w-20 flex-shrink-0 glass-panel border-r border-border/50 flex flex-col items-center py-8 gap-6"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Logo */}
        <Link to="/" className="mb-8">
          <motion.div
            className="w-10 h-10 rounded-xl glass-panel glass-glow flex items-center justify-center"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <div
              className="w-6 h-6 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, #00d9ff 0%, #8b7aff 100%)',
              }}
            />
          </motion.div>
        </Link>

        {/* Nav Items */}
        <div className="flex flex-col gap-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link key={item.path} to={item.path}>
                <motion.div
                  className="relative group"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      isActive
                        ? 'glass-panel glass-glow text-cyan-glow'
                        : 'text-silver-soft/60 hover:text-silver-soft hover:glass-panel'
                    }`}
                  >
                    <Icon size={20} />
                  </div>

                  {/* Tooltip */}
                  <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    <div className="glass-panel px-3 py-2 text-sm text-silver-soft">
                      {item.label}
                    </div>
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-glow rounded-full"
                      layoutId="activeIndicator"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </div>
      </motion.nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
