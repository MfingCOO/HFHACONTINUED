
"use client"
import { useEffect, useState, useMemo } from 'react';
import { ResponsiveContainer, Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts"
import { getWthrData, WthrDataPoint } from '@/services/firestore';
import { format, formatDistance, subMonths } from 'date-fns';
import { Loader2, TrendingDown, TrendingUp, Minus, X } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '../auth/auth-provider';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/dialog';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';

interface WthrTrendChartDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WthrTrendChartDialog({ isOpen, onClose }: WthrTrendChartDialogProps) {
    const { user } = useAuth();
    const [data, setData] = useState<WthrDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);
    const [timeframe, setTimeframe] = useState<'1m' | '3m' | '1y' | 'all'>('all');

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen && user) {
            setIsLoading(true);
            getWthrData(user.uid).then(result => {
                if (result.success && result.data) {
                    const formattedData = result.data.map(d => ({
                        ...d,
                        date: format(d.entryDate, 'MMM d'),
                    }));
                    setData(formattedData);
                }
                setIsLoading(false);
            });
        }
    }, [isOpen, user]);

    const filteredData = useMemo(() => {
        if (!data) return [];
        const now = new Date();
        switch (timeframe) {
            case '1m':
                return data.filter(d => new Date(d.entryDate) >= subMonths(now, 1));
            case '3m':
                return data.filter(d => new Date(d.entryDate) >= subMonths(now, 3));
            case '1y':
                return data.filter(d => new Date(d.entryDate) >= subMonths(now, 12));
            case 'all':
            default:
                return data;
        }
    }, [data, timeframe]);

    const { stats, domain } = useMemo(() => {
        if (filteredData.length < 2) return { stats: null, domain: [0.3, 0.7] };

        const firstEntry = filteredData[0];
        const lastEntry = filteredData[filteredData.length - 1];

        const startWthr = firstEntry.wthr;
        const currentWthr = lastEntry.wthr;
        const change = currentWthr - startWthr;
        const duration = formatDistance(lastEntry.entryDate, firstEntry.entryDate);
        
        const wthrs = filteredData.map(d => d.wthr);
        const minWthr = Math.min(...wthrs);
        const maxWthr = Math.max(...wthrs);

        const newStats = {
            start: startWthr.toFixed(3),
            startDate: format(new Date(firstEntry.entryDate), 'MMM d, yyyy'),
            current: currentWthr.toFixed(3),
            currentDate: format(new Date(lastEntry.entryDate), 'MMM d, yyyy'),
            change: `${change > 0 ? '+' : ''}${change.toFixed(3)}`,
            duration: `in ${duration}`,
            changeType: change > 0.01 ? 'increase' : change < -0.01 ? 'decrease' : 'neutral'
        };

        const domainMin = Math.max(0, Math.floor((minWthr - 0.05) * 10) / 10);
        const domainMax = Math.ceil((maxWthr + 0.05) * 10) / 10;

        return { stats: newStats, domain: [domainMin, domainMax] };
    }, [filteredData]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">WtHR</span>
                            <span className="font-bold text-muted-foreground">{data.wthr.toFixed(3)}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">Date</span>
                            <span className="font-bold">{label}</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };
    
    const TimeframeButtons = () => (
        <div className="flex justify-center gap-1 rounded-lg bg-muted p-1">
            {(['1m', '3m', '1y', 'all'] as const).map(period => (
                <Button 
                    key={period} 
                    onClick={() => setTimeframe(period)}
                    variant={timeframe === period ? 'secondary' : 'ghost'}
                    size="sm"
                    className="text-xs h-7 flex-1"
                >
                    {period.toUpperCase()}
                </Button>
            ))}
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[90vw] max-w-2xl">
                 <DialogHeader>
                    <DialogTitle>Waist-to-Height Ratio (WtHR) Trend</DialogTitle>
                     <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </DialogHeader>
                
                <div className="space-y-4">
                    {stats && (
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <p className="text-xs text-muted-foreground">Start</p>
                                <p className="font-bold text-lg">{stats.start}</p>
                                <p className="text-xs text-muted-foreground">{stats.startDate}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Current</p>
                                <p className="font-bold text-lg">{stats.current}</p>
                                <p className="text-xs text-muted-foreground">{stats.currentDate}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Change</p>
                                <p className={cn("font-bold text-lg flex items-center justify-center gap-1",
                                    stats.changeType === 'decrease' && 'text-green-400',
                                    stats.changeType === 'increase' && 'text-red-400'
                                )}>
                                    {stats.changeType === 'decrease' ? <TrendingDown className="h-4 w-4" /> : stats.changeType === 'increase' ? <TrendingUp className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                    {stats.change}
                                </p>
                                <p className="text-xs text-muted-foreground">{stats.duration}</p>
                            </div>
                        </div>
                    )}
                    
                    {!isMounted || isLoading ? (
                        <div className="h-[250px] w-full flex items-center justify-center">
                            <Skeleton className="h-full w-full" />
                        </div>
                    ) : filteredData.length > 1 ? (
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={filteredData}
                                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                                    <YAxis 
                                        tickLine={false} 
                                        axisLine={false} 
                                        tickMargin={8} 
                                        domain={domain}
                                        tick={{ fontSize: '0.75rem' }}
                                    />
                                    <XAxis
                                        dataKey="date"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        tickFormatter={(value) => value.slice(0, 3)}
                                        tick={{ fontSize: '0.75rem' }}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <defs>
                                        <linearGradient id="fillWthr" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                                        </linearGradient>
                                    </defs>
                                    <Area
                                        dataKey="wthr"
                                        type="natural"
                                        fill="url(#fillWthr)"
                                        stroke="hsl(var(--primary))"
                                        stackId="a"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[250px] w-full flex flex-col items-center justify-center text-center text-muted-foreground">
                            <p className="font-semibold">Not enough data to build a trend.</p>
                            <p className="text-sm">Log at least two measurements with waist to see your chart.</p>
                        </div>
                    )}
                    <TimeframeButtons />
                    
                    {filteredData.length > 0 && (
                        <ScrollArea className="h-24 w-full rounded-md border p-2">
                             <div className="space-y-1">
                                {filteredData.slice().reverse().map((entry, index) => (
                                    <div key={index} className="flex justify-between items-center text-sm p-1 rounded-md hover:bg-muted">
                                        <span className="text-muted-foreground">{format(new Date(entry.entryDate), 'MMM d, yyyy')}</span>
                                        <span className="font-semibold">{entry.wthr.toFixed(3)}</span>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
