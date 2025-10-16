
'use client';

import {
  HeartPulse,
  LayoutDashboard,
  Settings,
  Trophy,
  BarChart3,
  Dumbbell,
  Calendar,
  MessageSquare,
  Users,
  Lightbulb,
  Megaphone,
  Image as ImageIcon,
  Library,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarFooter
} from '@/components/ui/sidebar';
import { SheetHeader, SheetTitle } from '../ui/sheet';
import { Logo } from '@/components/icons/logo';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { UserNav } from '../auth/user-nav';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useAuth } from '../auth/auth-provider';
import { useDashboardActions } from '@/contexts/DashboardActionsContext';


const clientMenuItems = [
  { href: '/client/dashboard', label: 'Dashboard', icon: LayoutDashboard, isLink: true },
  { href: '#', label: 'Calendar', icon: Calendar, isLink: false, id: 'calendar' },
  { href: '#', label: 'Chats', icon: MessageSquare, isLink: false, id: 'chats' },
  { href: '#', label: 'Challenges', icon: Trophy, isLink: false, id: 'challenges' },
];

const coachMenuItems = [
    { href: '/coach/dashboard', label: 'Dashboard', icon: LayoutDashboard, isLink: true },
]

export function AppSidebar() {
  const pathname = usePathname();
  const { isCoach } = useAuth();
  const { onOpenChallenges, onOpenChats, onOpenCalendar } = useDashboardActions();


  const menuItems = isCoach ? coachMenuItems : clientMenuItems;
  const settingsHref = isCoach ? '/settings' : '/client/settings';

  const handleItemClick = (item: any) => {
    if (!item.isLink) {
        if (item.id === 'challenges') {
            onOpenChallenges();
        } else if (item.id === 'chats') {
            onOpenChats();
        } else if (item.id === 'calendar') {
            onOpenCalendar();
        }
    }
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <Logo className="text-primary size-8" />
        <h1 className="text-xl font-semibold tracking-tight">
          HungerFree
        </h1>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              {item.isLink ? (
                  <Link href={item.href!}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(item.href!)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
              ) : (
                 <SidebarMenuButton
                    isActive={false} // Non-links are actions, not active pages
                    tooltip={item.label}
                    onClick={() => handleItemClick(item)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                 </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      
       <SidebarFooter>
         <SidebarMenu>
            <SidebarMenuItem>
                <Link href={settingsHref}>
                    <SidebarMenuButton
                        isActive={pathname.startsWith(settingsHref)}
                        tooltip={"Settings"}
                    >
                        <Settings />
                        <span>Settings</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
            <div className="p-2 border-t mt-auto">
              <UserNav />
            </div>
         </SidebarMenu>
       </SidebarFooter>
    </Sidebar>
  );
}
