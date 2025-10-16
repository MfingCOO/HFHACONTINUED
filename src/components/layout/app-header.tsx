'use client';
import { UserNav } from '@/components/auth/user-nav';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logo } from '../icons/logo';
import { useAuth } from '../auth/auth-provider';
import { SidebarTrigger } from '../ui/sidebar';
import { useEffect, useState } from 'react';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';
import Link from 'next/link';

export function AppHeader() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { isCoach } = useAuth();
  const [siteUrl, setSiteUrl] = useState<string | null>(null);

  useEffect(() => {
    getSiteSettingsAction().then(result => {
        if (result.success && result.data?.url) {
            setSiteUrl(result.data.url);
        }
    });
  }, []);


  const getTitle = () => {
    if (pathname === '/') return 'Dashboard';
    const name = pathname.split('/').pop() ?? 'Dashboard';
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  
  const TitleContent = () => {
    if (isMobile) {
      return (
         <div className="flex items-center gap-2">
            <Logo className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg">Hunger-Free and Happy</span>
          </div>
      )
    }
     return <h1 className="text-xl font-semibold tracking-tight">{getTitle()}</h1>
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        {!isCoach && <SidebarTrigger className={cn("md:hidden", isMobile === undefined && "invisible")} />}
        {siteUrl ? (
          <Link href={siteUrl} target="_blank" rel="noopener noreferrer">
            <TitleContent />
          </Link>
        ) : (
          <TitleContent />
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="md:block">
            <UserNav />
        </div>
      </div>
    </header>
  );
}
