
'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Loader2, Briefcase, User, ZoomIn } from 'lucide-react';
import { format, startOfDay, addMinutes, addHours, differenceInMinutes, addDays, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useMemo, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const eventColors: Record<string, string> = {
    personal: 'bg-blue-500/80 border-blue-700',
    manual: 'bg-green-500/80 border-green-700',
    zoom: 'bg-primary/80 border-primary/90',
    default: 'bg-gray-500/80 border-gray-700',
};

interface PositionedEntry {
    id: string;
    top: number;
    height: number;
    left: number;
    width: number;
    originalData: any;
}

const processEntriesForLayout = (entries: any[], selectedDate: Date): PositionedEntry[] => {
    if (!entries || entries.length === 0) return [];
    
    const dayStart = startOfDay(selectedDate);
    const totalMinutesInDay = 24 * 60;

    const timedEntries = entries.map(entry => {
        const start = entry.start ? new Date(entry.start) : null;
        const end = entry.end ? new Date(entry.end) : null;
        if (!start || !end) return null;
        
        return {
            id: entry.id,
            startMinutes: Math.max(0, differenceInMinutes(start, dayStart)),
            endMinutes: Math.min(totalMinutesInDay, differenceInMinutes(end, dayStart)),
            originalData: entry,
        };
    })
    .filter(e => e !== null && e.endMinutes > e.startMinutes)
    .sort((a, b) => a!.startMinutes - b!.startMinutes || b!.endMinutes - a!.endMinutes);

    const positionedEntries: PositionedEntry[] = [];
    const eventClusters: any[][] = [];

    // Step 1: Cluster overlapping events
    for (const entry of timedEntries) {
        let placed = false;
        for (const cluster of eventClusters) {
            if (cluster.some(e => entry!.startMinutes < e.endMinutes && entry!.endMinutes > e.startMinutes)) {
                cluster.push(entry);
                placed = true;
                break;
            }
        }
        if (!placed) {
            eventClusters.push([entry!]);
        }
    }

    // Step 2: Position events within each cluster
    for (const cluster of eventClusters) {
        cluster.sort((a, b) => a.startMinutes - b.startMinutes);
        
        const cols: any[][] = [];
        for (const entry of cluster) {
            let placedInCol = false;
            for (let i = 0; i < cols.length; i++) {
                if (cols[i].every(e => entry.startMinutes >= e.endMinutes)) {
                    cols[i].push(entry);
                    placedInCol = true;
                    break;
                }
            }
            if (!placedInCol) {
                cols.push([entry]);
            }
        }
        
        const clusterWidth = 100 / cols.length;
        for (let i = 0; i < cols.length; i++) {
            for (const entry of cols[i]) {
                const durationMinutes = Math.max(1, entry.endMinutes - entry.startMinutes);
                const height = (durationMinutes / totalMinutesInDay) * 100;
                positionedEntries.push({
                    id: entry.id,
                    top: (entry.startMinutes / totalMinutesInDay) * 100,
                    height: Math.max(height, 2.0833), // Min height for a 15-min block
                    left: i * clusterWidth,
                    width: clusterWidth - 0.5, // Subtract a little for a gap,
                    originalData: entry.originalData,
                });
            }
        }
    }

    return positionedEntries;
};


const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
};


const TimelineEntry = ({ entry, onSelect }: { entry: PositionedEntry, onSelect: (entry: any) => void }) => {
    let Icon, colorClass;
    const { originalData } = entry;

    if (originalData.isPersonal) {
        Icon = Briefcase;
        colorClass = eventColors.personal;
    } else if (originalData.attendees) {
        Icon = ZoomIn;
        colorClass = eventColors.zoom;
    } else {
        Icon = User;
        colorClass = eventColors.manual;
    }

    return (
        <div 
            style={{ 
                top: `${entry.top}%`, 
                height: `${entry.height}%`,
                left: `${entry.left}%`,
                width: `${entry.width}%`,
                padding: '1px',
            }} 
            className={cn(
                "absolute rounded-lg overflow-hidden cursor-pointer",
                colorClass
            )}
            onClick={() => onSelect(originalData)}
        >
             <div className="relative flex items-center gap-1 p-1 text-white h-full bg-black/20 rounded-md">
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-[10px] font-medium truncate flex-1">{originalData.title}</span>
                {originalData.coachName && (
                     <Avatar className="h-4 w-4 flex-shrink-0 border-white/50 border">
                        <AvatarFallback className="text-[8px] bg-black/20">{getInitials(originalData.coachName)}</AvatarFallback>
                    </Avatar>
                )}
            </div>
        </div>
    );
};

interface DayViewProps {
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    events: any[];
    isLoading: boolean;
    onEventClick: (event: any) => void;
    onDayClick: (date: Date) => void;
}

export function DayView({ currentDate, setCurrentDate, events, isLoading, onEventClick }: DayViewProps) {
    const viewportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isLoading && viewportRef.current) {
            const HOURLY_HEIGHT = 60;
            const targetTotalMinutes = 6 * 60; // Scroll to 6 AM
            const scrollTop = (targetTotalMinutes / 60) * HOURLY_HEIGHT;
            viewportRef.current.scrollTo({ top: scrollTop, behavior: 'smooth' });
        }
    }, [isLoading]);

    const changeDay = (days: number) => {
        setCurrentDate(days > 0 ? addDays(currentDate, 1) : subDays(currentDate, 1));
    };

    const processedEntries = useMemo(() => processEntriesForLayout(events, currentDate), [events, currentDate]);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div className="flex flex-col h-full">
             <div className="flex-shrink-0 p-2 flex justify-between items-center border-b">
                <Button variant="ghost" size="icon" onClick={() => changeDay(-1)}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <h3 className="text-base font-semibold">{format(currentDate, 'PPP')}</h3>
                <Button variant="ghost" size="icon" onClick={() => changeDay(1)}>
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>
            
            <div className="flex-1 min-h-0 relative flex">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-20">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                )}
                 <ScrollArea className="h-full w-full" viewportRef={viewportRef}>
                    <div className="flex">
                        <div className="w-12 flex-shrink-0 pr-1 border-r">
                            {hours.map(hour => (
                                <div key={hour} className="h-[60px] text-right relative -top-2.5">
                                    <span className="text-[10px] text-muted-foreground pr-1">{format(new Date(0, 0, 0, hour), 'ha')}</span>
                                </div>
                            ))}
                        </div>
                        <div className="relative flex-1">
                             {hours.map(hour => (
                                <div key={hour} className="h-[60px] border-b" />
                            ))}
                           {processedEntries.map(entry => (
                               <TimelineEntry key={entry.id} entry={entry} onSelect={onEventClick} />
                           ))}
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
