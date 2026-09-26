/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from './firebase/authContext';
import { AppPinProvider, useAppPin } from './context/AppPinContext';
import { AppProvider, useApp } from './context/AppContext';
import { FirebaseAuthScreen } from './components/auth/FirebaseAuthScreen';
import { AppPinScreen } from './components/auth/AppPinScreen';
import { AuthModal } from './components/auth/AuthModal';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { HomeDashboard } from './components/dashboard/HomeDashboard';
import { JournalView } from './components/journal/JournalView';
import { MemoriesView } from './components/memories/MemoriesView';
import { LettersView } from './components/letters/LettersView';
import { CalendarView } from './components/calendar/CalendarView';
import { DreamsView } from './components/dreams/DreamsView';
import { AIFriendView } from './components/aifriend/AIFriendView';
import { CareerView } from './components/career/CareerView';
import { FilesView } from './components/files/FilesView';
import { VaultView } from './components/vault/VaultView';
import { SettingsView } from './components/settings/SettingsView';
import { QuickActionsModal } from './components/common/QuickActionsModal';

const AppContent: React.FC = () => {
  const { activeTab } = useApp();

  return (
    <div className="min-h-screen bg-[#080809] text-[#E8E6EB] flex flex-col md:flex-row relative">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Top and Bottom Navigation */}
      <MobileNav />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 pb-20 md:pb-12 overflow-y-auto">
        {activeTab === 'home' && <HomeDashboard />}
        {activeTab === 'journal' && <JournalView />}
        {activeTab === 'letters' && <LettersView />}
        {activeTab === 'memories' && <MemoriesView />}
        {activeTab === 'files' && <FilesView />}
        {activeTab === 'vault' && <VaultView />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'dreams' && <DreamsView />}
        {activeTab === 'aifriend' && <AIFriendView />}
        {activeTab === 'career' && <CareerView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Shared Quick Action Modal */}
      <QuickActionsModal />

      {/* Cloud Authentication Modal */}
      <AuthModal />
    </div>
  );
};

const AppGates: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const { isPinUnlocked } = useAppPin();

  // 1. Loading splash while Firebase Auth initializes session
  if (loading) {
    return (
      <div className="min-h-screen bg-[#080809] flex flex-col items-center justify-center text-[#E8E6EB]">
        <div className="w-10 h-10 rounded-full border-2 border-[#B8A4D8]/30 border-t-[#B8A4D8] animate-spin mb-4" />
        <span className="text-xs font-light text-[#929099] tracking-wider uppercase">Loading Sanctuary...</span>
      </div>
    );
  }

  // 2. Primary Gate: Firebase Authentication
  if (!currentUser) {
    return <FirebaseAuthScreen />;
  }

  // 3. Secondary Gate: 6-Digit App-Wide Secret PIN Lock
  if (!isPinUnlocked) {
    return <AppPinScreen />;
  }

  // 4. Authenticated & PIN-Unlocked Private Application Dashboard
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppPinProvider>
        <AppGates />
      </AppPinProvider>
    </AuthProvider>
  );
}

