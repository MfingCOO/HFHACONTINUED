'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Chat } from '@/services/firestore';
import { useAuth } from '@/components/auth/auth-provider';
import { getChatsForClient } from '@/app/chats/actions';

// 1. Define the types for the state and actions
interface DashboardState {
  chats: Chat[];
  hasUnreadChats: boolean;
  fetchChats: () => void;
}

interface DashboardActions {
  onOpenChallenges: () => void;
  onOpenChats: () => void;
  onOpenCalendar: () => void;
  onOpenSettings: () => void;
  isChallengesOpen: boolean;
  isChatsOpen: boolean;
  isCalendarOpen: boolean;
  isSettingsOpen: boolean;
  onCloseChallenges: () => void;
  onCloseChats: () => void;
  onCloseCalendar: () => void;
  onCloseSettings: () => void;
}

// 2. Create two separate contexts
const DashboardStateContext = createContext<DashboardState | undefined>(undefined);
const DashboardActionsContext = createContext<DashboardActions | undefined>(undefined);

// 3. Create a single provider that manages everything
export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // State for the data
  const [chats, setChats] = useState<Chat[]>([]);
  
  // State for the UI actions (dialogs)
  const [isChallengesOpen, setIsChallengesOpen] = useState(false);
  const [isChatsOpen, setIsChatsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const fetchChats = useCallback(async () => {
    if (!user) return;
    const result = await getChatsForClient(user.uid);
    if (result.success && result.data) {
      setChats(result.data);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchChats();
    // The polling `setInterval` has been removed.
  }, [user, fetchChats]);

  const hasUnreadChats = useMemo(() => {
    if (!user || !chats) return false;
    return chats.some(chat => {
      const lastSenderId = chat.lastMessageSenderId;
      // An unread message exists if the last sender was not the current user.
      // This also correctly handles the case where lastMessageSenderId is null or undefined initially.
      return lastSenderId && lastSenderId !== user.uid;
    });
  }, [chats, user]);

  // Memoize the context values to prevent unnecessary re-renders
  const stateValue = useMemo(() => ({
    chats,
    hasUnreadChats,
    fetchChats
  }), [chats, hasUnreadChats, fetchChats]);

  const actionsValue = useMemo(() => ({
    onOpenChallenges: () => setIsChallengesOpen(true),
    onOpenChats: () => setIsChatsOpen(true),
    onOpenCalendar: () => setIsCalendarOpen(true),
    onOpenSettings: () => setIsSettingsOpen(true),
    isChallengesOpen,
    isChatsOpen,
    isCalendarOpen,
    isSettingsOpen,
    onCloseChallenges: () => setIsChallengesOpen(false),
    onCloseChats: () => setIsChatsOpen(false),
    onCloseCalendar: () => setIsCalendarOpen(false),
    onCloseSettings: () => setIsSettingsOpen(false),
  }), [isChallengesOpen, isChatsOpen, isCalendarOpen, isSettingsOpen]);

  return (
    <DashboardStateContext.Provider value={stateValue}>
      <DashboardActionsContext.Provider value={actionsValue}>
        {children}
      </DashboardActionsContext.Provider>
    </DashboardStateContext.Provider>
  );
}

// 4. Create separate hooks for consuming the state and actions
export function useDashboardState() {
  const context = useContext(DashboardStateContext);
  if (context === undefined) {
    throw new Error('useDashboardState must be used within a DashboardProvider');
  }
  return context;
}

export function useDashboardActions() {
  const context = useContext(DashboardActionsContext);
  if (context === undefined) {
    throw new Error('useDashboardActions must be used within a DashboardProvider');
  }
  return context;
}
