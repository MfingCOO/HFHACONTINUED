
'use client';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { DashboardProvider, useDashboardActions } from '@/contexts/DashboardActionsContext';
import { SettingsDialog } from '@/components/settings/SettingsDialog';

// This is a wrapper component because hooks can't be called directly in the layout if it uses props.
const CoachLayoutContent = ({ children }: { children: React.ReactNode }) => {
    const { onOpenSettings, isSettingsOpen, onCloseSettings } = useDashboardActions();
    
    // We can now call the hook here to get the actions
    // This could also be done in a separate DialogManager component like in ClientLayout
    const handleOpenSettings = () => {
      onOpenSettings();
    }

    return (
        <>
        <AppHeader />
        <main className="p-4 sm:p-6 lg:p-8 pb-24 max-w-7xl mx-auto">
            {children}
        </main>
        <SettingsDialog
            open={isSettingsOpen}
            onOpenChange={onCloseSettings}
        />
        </>
    )
}


// This layout relies entirely on the AuthProvider for protection.
// If a user reaches this layout, it means AuthProvider has finished loading
// and confirmed the user is an authenticated coach.
export default function CoachLayout({
  children,
}: {
  children: React.ReactNode
}) {
    const { isCoach, loading, user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // This effect handles the edge case where a client might try to access a coach URL.
        if (!loading && user && !isCoach) {
            router.replace('/');
        }
    }, [isCoach, loading, user, router]);
    
    // AuthProvider handles the main loading state. If we reach here, user is authenticated.
    // We don't need a separate loader here.
    if (loading || !user) {
        return null; // The main loader in AuthProvider is active.
    }

  return (
    <DashboardProvider>
        <CoachLayoutContent>{children}</CoachLayoutContent>
    </DashboardProvider>
  )
}
