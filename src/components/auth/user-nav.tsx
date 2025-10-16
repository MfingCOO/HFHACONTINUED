
'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from './auth-provider';
import { useDashboardActions } from '@/contexts/DashboardActionsContext';

export function UserNav() {
  const { user } = useAuth();
  const { onOpenSettings } = useDashboardActions();

  if (!user) {
    return null;
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };
  
  return (
    <Button
        variant="ghost"
        className="relative h-10 w-10 rounded-full"
        onClick={onOpenSettings}
    >
        <Avatar className="h-10 w-10 border">
        <AvatarImage src={user.photoURL || `https://placehold.co/100x100.png`} alt={user.displayName || 'User'} data-ai-hint="person portrait" />
        <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
        </Avatar>
    </Button>
  );
}
