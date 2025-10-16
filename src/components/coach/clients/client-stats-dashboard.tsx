
'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { ClientProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Moon, Flame, Droplet, UtensilsCrossed, Apple, HeartCrack, ShieldAlert } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { differenceInDays } from 'date-fns';
import type { LucideIcon } from 'lucide-react';

interface ClientStatsDashboardProps {
  client: ClientProfile;
  onDeleteClient: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const MiniStat = ({ icon: Icon, value, unit }: { icon: LucideIcon; value: string; unit: string }) => (
  <div className="flex flex-col items-center gap-0.5">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <span className="text-xs font-bold">{value}</span>
    <span className="text-[10px] text-muted-foreground -mt-1">{unit}</span>
  </div>
);

const StaticInfo = ({ title, value }: { title: string; value: string | number }) => (
    <div className="text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="font-bold text-sm">{value}</p>
    </div>
);


export function ClientStatsDashboard({
  client,
  onDeleteClient,
  onRefresh,
  isRefreshing,
}: ClientStatsDashboardProps) {
  const summary = client.dailySummary;

  const getStatValue = (value: any, fractionDigits = 0) => {
    const num = Number(value);
    if (value === null || value === undefined || isNaN(num)) return 'N/A';
    return num.toFixed(fractionDigits);
  }

  const durationInDays = client.createdAt ? differenceInDays(new Date(), new Date(client.createdAt as string)) : 0;

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold truncate">{client.fullName}</h3>
            <p className="text-sm text-muted-foreground truncate">{client.email}</p>
          </div>
          <div className="flex-shrink-0 flex gap-2">
            <Button onClick={onRefresh} disabled={isRefreshing} size="sm">
              {isRefreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Refresh
            </Button>
            <Button onClick={onDeleteClient} variant="destructive" size="sm">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />
        
        <div className="grid grid-cols-5 gap-1">
            <StaticInfo title="Weight" value={`${getStatValue(summary?.currentWeight, 1)} ${summary?.unit || ''}`} />
            <StaticInfo title="WtHR" value={getStatValue(summary?.currentWthr, 2)} />
            <StaticInfo title="Age" value={summary?.age ?? 'N/A'} />
            <StaticInfo title="Sex" value={summary?.sex ? summary.sex.charAt(0).toUpperCase() : 'N/A'} />
            <StaticInfo title="Duration" value={`${durationInDays}d`} />
        </div>
        
        <Separator />

        <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 text-center">7-DAY AVERAGES</h4>
            <div className="grid grid-cols-4 gap-2">
                <MiniStat icon={Moon} value={getStatValue(summary?.avgSleep, 1)} unit="hr" />
                <MiniStat icon={Flame} value={getStatValue(summary?.avgActivity)} unit="min" />
                <MiniStat icon={Droplet} value={getStatValue(summary?.avgHydration)} unit="oz" />
                <MiniStat icon={UtensilsCrossed} value={getStatValue(summary?.avgUpf)} unit="%" />
            </div>
        </div>
        
        <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 text-center">7-DAY TOTALS</h4>
             <div className="grid grid-cols-3 gap-2">
                <MiniStat icon={Apple} value={getStatValue(summary?.cravings)} unit="Cravings" />
                <MiniStat icon={HeartCrack} value={getStatValue(summary?.binges)} unit="Binges" />
                <MiniStat icon={ShieldAlert} value={getStatValue(summary?.stressEvents)} unit="Stress" />
            </div>
        </div>

      </CardContent>
    </Card>
  );
}
