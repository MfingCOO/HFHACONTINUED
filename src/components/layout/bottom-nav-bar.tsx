
'use client';
import { BarChart3, Calendar, Home, MessageSquare, Trophy, Lock, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth/auth-provider';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';
import { UpgradeModal } from '../modals/upgrade-modal';
import { UserTier, TIER_ACCESS } from '@/types';
import { useDashboardActions, useDashboardState } from '@/contexts/DashboardActionsContext';

export function BottomNavBar() {
    const pathname = usePathname();
    const { user, isCoach, userProfile } = useAuth();
    const isMobile = useIsMobile();
    const router = useRouter();
    const { onOpenChallenges, onOpenChats, onOpenCalendar, onOpenSettings } = useDashboardActions();
    const { hasUnreadChats } = useDashboardState();


    const navItems = [
        { href: '/client/dashboard', label: 'Home', icon: Home, action: () => router.push('/client/dashboard') },
        { href: '#', label: 'Calendar', icon: Calendar, action: onOpenCalendar },
        { href: '#', label: 'Chats', icon: MessageSquare, action: onOpenChats },
        { href: '#', label: 'Challenges', icon: Trophy, action: onOpenChallenges },
        { href: '#', label: 'Profile', icon: User, action: onOpenSettings },
    ];

    if (!isMobile || !user || isCoach) {
        return null;
    }
    
    const handleItemClick = (e: React.MouseEvent<HTMLButtonElement>, item: typeof navItems[0]) => {
        e.preventDefault();
        item.action();
    };


    return (
        <>
        <footer className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t bg-background/95 backdrop-blur-sm md:hidden">
            <nav className="flex items-center justify-around h-full">
                {navItems.map((item) => {
                    const isActive = item.href !== '#' && pathname.startsWith(item.href);
                    
                    return (
                        <button
                            key={item.label}
                            onClick={(e) => handleItemClick(e, item)}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full text-muted-foreground transition-colors relative",
                                isActive ? "text-primary" : "hover:text-primary/80",
                                item.href === '/client/dashboard' && pathname === '/client/dashboard' && "text-primary"
                            )}
                        >
                            {item.label === 'Chats' && hasUnreadChats && (
                                <div className="absolute top-2 right-1/2 translate-x-[20px] h-2 w-2 rounded-full bg-blue-500" />
                            )}
                            <item.icon className="h-6 w-6" />
                            <span className="text-xs font-medium">{item.label}</span>
                        </button>
                    )
                })}
            </nav>
        </footer>
        </>
    );
}
