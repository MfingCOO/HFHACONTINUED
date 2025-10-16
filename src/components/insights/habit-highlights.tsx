
'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/auth-provider';
import { getHabitHighlights, HabitHighlights } from '@/services/firestore';
import { Loader2, Droplet, Moon, Flame, UtensilsCrossed, HeartCrack, ShieldAlert, Apple } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import type { LucideIcon } from 'lucide-react';

const MiniStat = ({ icon: Icon, title, value, unit }: { icon: LucideIcon; title: string; value: string; unit: string }) => (
  <div className="flex flex-col items-center justify-center text-center gap-0.5 p-1 rounded-lg bg-white/5">
    <Icon className="h-4 w-4 text-primary" />
    <span className="text-sm font-bold text-white">{value}</span>
    <span className="text-[10px] text-white/70 leading-none">{unit}</span>
  </div>
);


export function HabitHighlightsDisplay() {
    const { user } = useAuth();
    const [highlights, setHighlights] = useState<HabitHighlights | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user) {
            setIsLoading(true);
            getHabitHighlights(user.uid, 7).then(result => {
                if (result.success && result.data) {
                    setHighlights(result.data);
                }
                setIsLoading(false);
            });
        }
    }, [user]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!highlights) {
        return <p className="text-center text-sm text-white/70">Not enough data to show highlights.</p>
    }

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
                <MiniStat 
                    icon={UtensilsCrossed}
                    title="Avg. Calories"
                    value={highlights.averageCalories?.toFixed(0) || '-'}
                    unit="kcal/day"
                />
                <MiniStat 
                    icon={Flame}
                    title="Avg. Activity"
                    value={highlights.averageActivity?.toFixed(0) || '-'}
                    unit="min/day"
                />
                 <MiniStat 
                    icon={Moon}
                    title="Avg. Sleep"
                    value={highlights.averageSleep?.toFixed(1) || '-'}
                    unit="hrs/night"
                />
                <MiniStat 
                    icon={Droplet}
                    title="Avg. Hydration"
                    value={highlights.averageHydration?.toFixed(0) || '-'}
                    unit="oz/day"
                />
            </div>
            <div className="grid grid-cols-4 gap-2">
                 <MiniStat 
                    icon={ShieldAlert}
                    title="Avg. UPF Score"
                    value={highlights.averageUpfScore?.toFixed(0) || '-'}
                    unit="/ 100"
                />
                <MiniStat 
                    icon={Apple}
                    title="Cravings"
                    value={String(highlights.cravingsLogged)}
                    unit="logged"
                />
                 <MiniStat 
                    icon={HeartCrack}
                    title="Binges"
                    value={String(highlights.bingesLogged)}
                    unit="logged"
                />
                 <MiniStat 
                    icon={ShieldAlert}
                    title="Stress Events"
                    value={String(highlights.stressEventsLogged)}
                    unit="logged"
                />
            </div>
        </div>
    )
}
