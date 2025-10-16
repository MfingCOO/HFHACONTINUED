
'use client';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter, type AppRouterInstance } from 'next/navigation';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { BottomNavBar } from '@/components/layout/bottom-nav-bar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { getReminderAction, Reminder } from '@/services/reminders';
import { SmartReminderModal } from '@/components/modals/SmartReminderModal';
import { GoogleAd } from '@/components/ads/google-ad';
import { ChallengesDialog } from '@/components/challenges/challenges-dialog';
import { ChatsDialog } from '@/components/chats/chats-dialog';
import { DashboardProvider, useDashboardActions } from '@/contexts/DashboardActionsContext';
import { CalendarDialog } from '@/components/calendar/calendar-dialog';
import type { ClientProfile } from '@/types';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { differenceInMilliseconds } from 'date-fns';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  router: AppRouterInstance;
  toast: ({...args}: any) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Error Boundary Component with automated recovery
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Caught by local error boundary:", error, errorInfo);
    
    this.props.toast({
        variant: 'default',
        title: 'So Sorry!',
        description: 'It looks like we hit a small snag. Your last action might not have been saved, but you\'re safely back on the dashboard.',
        duration: 2000,
    });
    
    this.props.router.push('/client/dashboard');

    setTimeout(() => this.setState({ hasError: false }), 50);
  }

  render() {
    if (this.state.hasError) {
      return (
         <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-2">Redirecting to dashboard...</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// A new component to contain the dialogs and consume the context
function DialogManager() {
    const { userProfile } = useAuth();
    const {
        isChallengesOpen,
        onCloseChallenges,
        isChatsOpen,
        onCloseChats,
        isCalendarOpen,
        onCloseCalendar,
        isSettingsOpen,
        onCloseSettings
    } = useDashboardActions();

    return (
        <>
            <ChallengesDialog 
                isOpen={isChallengesOpen}
                onClose={onCloseChallenges}
            />
            <ChatsDialog
                isOpen={isChatsOpen}
                onClose={onCloseChats}
            />
            {userProfile && (
                <CalendarDialog
                    isOpen={isCalendarOpen}
                    onClose={onCloseCalendar}
                    client={userProfile as ClientProfile}
                />
            )}
            <SettingsDialog
                open={isSettingsOpen}
                onOpenChange={onCloseSettings}
            />
        </>
    );
}


export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, isCoach, userProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [reminder, setReminder] = useState<(Reminder & { id: string }) | null>(null);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  
  useEffect(() => {
    if (!loading && user && !isCoach && userProfile) {
      const checkRemindersAndPopups = async () => {
        if (isReminderOpen) return;

        if (userProfile?.trackingSettings?.reminders !== false) {
          const reminderResult = await getReminderAction(user.uid);
          if (reminderResult.success && reminderResult.reminder) {
            setReminder(reminderResult.reminder as Reminder & { id: string });
            setIsReminderOpen(true);
          }
        }
      };

      checkRemindersAndPopups();

      let timeoutId: NodeJS.Timeout;
      const scheduleNextHourlyCheck = () => {
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(now.getHours() + 1, 0, 0, 0);
        const msUntilNextHour = differenceInMilliseconds(nextHour, now);
        
        timeoutId = setTimeout(() => {
          checkRemindersAndPopups();
          scheduleNextHourlyCheck();
        }, msUntilNextHour);
      };

      scheduleNextHourlyCheck();

      return () => clearTimeout(timeoutId);
    }
  }, [user, loading, isCoach, userProfile, isReminderOpen]);



  useEffect(() => {
    if (!loading && user && isCoach) {
      router.replace('/coach/dashboard');
    }
  }, [user, loading, isCoach, router]);

  if (loading || !user || isCoach) {
    return null; 
  }
  
  const handleReminderClose = () => {
    setIsReminderOpen(false);
    setReminder(null);
  }
  
  return (
    <DashboardProvider>
      <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="h-dvh flex flex-col">
            <AppHeader />
            <main className="flex-1 overflow-y-auto">
             <ErrorBoundary router={router} toast={toast}>
              <div className="p-4 sm:p-6 lg:p-8 pb-24">
                {children}
              </div>
              {userProfile?.tier === 'free' && (
                <div className="sticky bottom-16 w-full p-2 bg-background/80 backdrop-blur-sm">
                  <GoogleAd slotId={process.env.NEXT_PUBLIC_AD_SLOT_ID_2!} />
                </div>
              )}
             </ErrorBoundary>
            </main>
            <BottomNavBar />
          </SidebarInset>
          
          {reminder && (
            <SmartReminderModal
              isOpen={isReminderOpen}
              onClose={handleReminderClose}
              reminder={reminder}
            />
          )}
          <DialogManager />
      </SidebarProvider>
    </DashboardProvider>
  )
}
