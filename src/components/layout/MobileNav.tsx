import React, { useState } from 'react';
import {
  Home,
  BookOpen,
  Image,
  Sparkles,
  Calendar,
  Heart,
  Compass,
  Settings,
  Moon,
  Menu,
  X,
  Feather,
  Folder,
  Shield,
  Mail,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ActiveTab } from '../../types';
import { UserStatusBadge } from '../auth/UserStatusBadge';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, userProfile, toggleLowEnergyMode } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);

  interface MenuItem {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description?: string;
  }

  const bottomTabs: MenuItem[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'memories', label: 'Memories', icon: Image },
    { id: 'dreams', label: 'Dreams', icon: Sparkles },
  ];

  const moreTabs: MenuItem[] = [
    { id: 'letters', label: 'Future Letters', icon: Mail, description: 'Sealed notes across time' },
    { id: 'files', label: 'My Files', icon: Folder, description: 'Documents & project files' },
    { id: 'vault', label: 'Private Vault', icon: Shield, description: 'Client-encrypted private safe' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, description: 'Gentle rituals & dates' },
    { id: 'aifriend', label: 'AI Best Friend', icon: Heart, description: 'Quiet companion' },
    { id: 'career', label: 'Career', icon: Compass, description: 'Quiet milestones & projects' },
    { id: 'settings', label: 'Settings', icon: Settings, description: 'Sanctuary preferences' },
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-30 h-14 bg-[#080809]/95 backdrop-blur-md border-b border-[#27272B] px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#151518] border border-[#27272B] flex items-center justify-center text-[#B8A4D8]">
            <Feather className="w-3 h-3" />
          </div>
          <span className="text-sm font-normal tracking-wide text-[#E8E6EB]">
            My Little World
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Low Energy Mode button */}
          <button
            onClick={toggleLowEnergyMode}
            className={`min-h-[36px] px-2.5 py-1 rounded-full border text-xs font-light flex items-center gap-1.5 transition-colors ${
              userProfile.lowEnergyMode
                ? 'bg-[#B8A4D8]/15 border-[#B8A4D8]/50 text-[#B8A4D8]'
                : 'bg-[#151518] border-[#27272B] text-[#929099]'
            }`}
            title="Toggle low energy mode"
          >
            <Moon className="w-3 h-3" />
            <span className="text-[11px]">
              {userProfile.lowEnergyMode ? 'Low Energy' : 'Gentle'}
            </span>
          </button>

          {/* Quick Menu Drawer trigger */}
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#929099] hover:text-[#E8E6EB]"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-[#080809]/95 backdrop-blur-md border-t border-[#27272B] px-2 flex items-center justify-around">
        {bottomTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelectTab(tab.id)}
              className={`flex-1 min-h-[48px] flex flex-col items-center justify-center transition-colors ${
                isActive ? 'text-[#B8A4D8]' : 'text-[#929099]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-light mt-1 tracking-tight">
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* More Drawer Button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className={`flex-1 min-h-[48px] flex flex-col items-center justify-center transition-colors ${
            ['letters', 'files', 'vault', 'calendar', 'aifriend', 'career', 'settings'].includes(activeTab)
              ? 'text-[#B8A4D8]'
              : 'text-[#929099]'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-light mt-1 tracking-tight">
            More
          </span>
        </button>
      </nav>

      {/* Mobile Slide-Up Drawer for Additional Pages */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end bg-black/60 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative z-10 bg-[#101012] border-t border-[#27272B] rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
            {/* Grab handle */}
            <div className="w-10 h-1 bg-[#27272B] rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-widest text-[#929099] font-light">
                All Sanctuary Spaces
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#929099] hover:text-[#E8E6EB]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cloud Account Status */}
            <div className="mb-4">
              <UserStatusBadge />
            </div>

            <div className="space-y-2">
              {[...bottomTabs, ...moreTabs].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleSelectTab(tab.id)}
                    className={`w-full flex items-center gap-3.5 p-3 rounded-2xl border text-left transition-colors min-h-[52px] ${
                      isActive
                        ? 'bg-[#151518] border-[#B8A4D8]/30 text-[#E8E6EB]'
                        : 'bg-[#101012] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                        isActive
                          ? 'border-[#B8A4D8]/40 bg-[#B8A4D8]/10 text-[#B8A4D8]'
                          : 'border-[#27272B] bg-[#151518] text-[#929099]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-light text-[#E8E6EB]">
                        {tab.label}
                      </span>
                      {'description' in tab && (
                        <span className="text-xs text-[#929099] font-light">
                          {tab.description}
                        </span>
                      )}
                    </div>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#B8A4D8]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Low Energy Mode Banner in Drawer */}
            <div className="mt-5 p-4 rounded-2xl bg-[#151518] border border-[#27272B] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#E8E6EB] font-light block">
                  Low Energy Mode
                </span>
                <span className="text-[11px] text-[#929099] font-light">
                  Gentle minimal view with zero pressure
                </span>
              </div>
              <button
                onClick={toggleLowEnergyMode}
                className={`min-h-[44px] px-3 rounded-xl border text-xs font-light transition-colors ${
                  userProfile.lowEnergyMode
                    ? 'bg-[#B8A4D8] text-[#080809] border-[#B8A4D8]'
                    : 'bg-[#101012] text-[#929099] border-[#27272B]'
                }`}
              >
                {userProfile.lowEnergyMode ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
