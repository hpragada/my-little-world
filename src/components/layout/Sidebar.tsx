import React from 'react';
import {
  Home,
  BookOpen,
  Image,
  Calendar,
  Sparkles,
  Heart,
  Compass,
  Settings,
  Moon,
  Sun,
  Feather,
  Folder,
  Shield,
  Mail,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ActiveTab } from '../../types';
import { MOOD_OPTIONS } from '../../data/initialData';

import { UserStatusBadge } from '../auth/UserStatusBadge';

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'letters', label: 'Future Letters', icon: Mail },
  { id: 'memories', label: 'Memories', icon: Image },
  { id: 'files', label: 'My Files', icon: Folder },
  { id: 'vault', label: 'Private Vault', icon: Shield },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'dreams', label: 'Dreams', icon: Sparkles },
  { id: 'aifriend', label: 'AI Best Friend', icon: Heart },
  { id: 'career', label: 'Career', icon: Compass },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, userProfile, toggleLowEnergyMode } = useApp();
  const currentMoodObj = MOOD_OPTIONS.find((m) => m.id === userProfile.currentMood);

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-[#080809] border-r border-[#27272B] select-none z-30">
      {/* Brand Header */}
      <div className="px-6 pt-7 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#151518] border border-[#27272B] flex items-center justify-center text-[#B8A4D8]">
            <Feather className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-normal tracking-wide text-[#E8E6EB]">
              My Little World
            </span>
            <span className="text-[11px] text-[#929099] font-light">
              private sanctuary
            </span>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-light transition-colors text-left ${
                isActive
                  ? 'bg-[#151518] text-[#E8E6EB] border border-[#27272B]'
                  : 'text-[#929099] hover:text-[#E8E6EB] hover:bg-[#101012] border border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-colors ${
                  isActive ? 'text-[#B8A4D8]' : 'text-[#929099]'
                }`}
              />
              <span className="truncate">{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1 h-1 rounded-full bg-[#B8A4D8]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Low Energy Mode Switch */}
      <div className="p-3 mx-3 mb-3 rounded-2xl bg-[#101012] border border-[#27272B]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon
              className={`w-3.5 h-3.5 transition-colors ${
                userProfile.lowEnergyMode ? 'text-[#B8A4D8]' : 'text-[#929099]'
              }`}
            />
            <span className="text-xs font-light text-[#E8E6EB]">
              Low Energy Mode
            </span>
          </div>
          <button
            onClick={toggleLowEnergyMode}
            type="button"
            role="switch"
            aria-checked={userProfile.lowEnergyMode}
            aria-label="Toggle low energy mode"
            className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-[#B8A4D8] ${
              userProfile.lowEnergyMode ? 'bg-[#B8A4D8]' : 'bg-[#27272B]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-[#080809] transition-transform ${
                userProfile.lowEnergyMode ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-[#929099] leading-relaxed font-light">
          {userProfile.lowEnergyMode
            ? 'Gentle mode active · Take it slow today'
            : 'Gentle pacing for calm, restful days'}
        </p>
      </div>

      {/* User Mini Bar & Cloud Status */}
      <div className="p-3 border-t border-[#27272B] space-y-2">
        <UserStatusBadge />
        <button
          onClick={() => setActiveTab('settings')}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-[#151518] text-left group w-full transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-[#18181D] border border-[#27272B] flex items-center justify-center text-[11px] text-[#B8A4D8]">
            {userProfile.name.charAt(0)}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs text-[#E8E6EB] truncate font-light group-hover:text-[#B8A4D8] transition-colors">
              {userProfile.name}
            </span>
            <span className="text-[10px] text-[#929099] truncate font-light flex items-center gap-1">
              <span>{currentMoodObj?.symbol}</span>
              <span>{currentMoodObj?.label}</span>
            </span>
          </div>
        </button>
      </div>
    </aside>
  );
};
