
'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format, startOfDay, addMinutes, addHours, differenceInMinutes, subDays } from 'date-fns';
import { pillarDetails } from '@/lib/pillars';
import type { ClientProfile } from '@/types';
import { cn } from '@/lib/utils';
import { DataEntryDialog } from '../dashboard/data-entry-dialog';
import { deleteData } from '@/services/firestore';
import { useToast } from '@/hooks/use-toast';
import { pillarsAndTools } from '@/lib/pillars';
import { AppointmentDetailDialog } from './AppointmentDetailDialog';

const pillarColors: Record<string, string> = {
    nutrition: 'bg-amber-500 border-amber-700',
    activity: 'bg-orange-500 border-orange-700',
    sleep: 'bg-indigo-500 border-indigo-700',
    'sleep-nap': 'bg-indigo-500/70 border-indigo-600',
    hydration: 'bg-blue-500 border-blue-700',
    stress: 'bg-red-600 border-red-800',
    relief: 'bg-green-500 border-green-700',
    measurements: 'bg-gray-500 border-gray-700',
    protocol: 'bg-teal-500 border-teal-700',
    planner: 'bg-lime-500 border-lime-700',
    craving: 'bg-orange-600 border-orange-800',
    binge: 'bg-red-600 border-red-800',
    habit: 'bg-yellow-500 border-yellow-700',
    appointment: 'bg-purple-500 border-purple-700',
    default: 'bg-gray-500 border-gray-700',
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

    // 1. Pre-process entries to calculate their start and end times in minutes.
    const timedEntries = entries.map(entry => {
        let start: Date | null = null;
        let end: Date | null = null;
        
        const entryDate = entry.entryDate ? new Date(entry.entryDate) : null;
        
        if (entry.pillar === 'sleep' && entryDate) {
            start = entryDate;
            end = addHours(start, entry.duration || 0);
        } else if (entry.pillar === 'activity' && entryDate) {
            start = entryDate;
            end = addMinutes(start, entry.duration || 15);
        } else if (entry.pillar === 'appointment') {
             start = entry.start ? new Date(entry.start) : null;
             end = entry.end ? new Date(entry.end) : null;
        } else {
            // Default all other "point-in-time" entries to a 15-minute duration.
            const baseDate = entry.indulgenceDate ? new Date(entry.indulgenceDate) : entryDate;
            if (baseDate) {
                start = baseDate;
                end = addMinutes(start, 15);
            }
        }

        if (!start || !end) return null;
        
        return {
            ...entry, // This is the fix: carry over all original properties
            id: entry.id,
            startMinutes: Math.max(0, differenceInMinutes(start, dayStart)),
            endMinutes: Math.min(totalMinutesInDay, differenceInMinutes(end, dayStart)),
            originalData: entry,
        };
    })
    .filter((e): e is { id: string; startMinutes: number; endMinutes: number; originalData: any; } => e !== null && e.endMinutes > e.startMinutes)
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
            eventClusters.push([entry]);
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
                    width: clusterWidth,
                    originalData: entry.originalData,
                });
            }
        }
    }


    return positionedEntries;
};

const TimelineEntry = ({ entry, onSelect }: { entry: PositionedEntry, onSelect: (entry: any) => void }) => {
    const pillarKey = entry.originalData.displayPillar || entry.originalData.pillar || 'default';
    const details = pillarDetails[pillarKey] || pillarDetails.default;
    const Icon = details.icon;
    const colorClass = pillarColors[pillarKey] || pillarColors.default;

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
            onClick={() => onSelect(entry.originalData)}
        >
             <div className="relative flex items-center gap-1 p-1 text-white h-full bg-black/20 rounded-md">
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-[10px] font-medium truncate">{details.getTitle(entry.originalData)}</span>
            </div>
        </div>
    );
};

interface DayViewProps {
    client: ClientProfile;
    selectedDate: Date;
    entries: any[];
    isLoading: boolean;
    onDateChange: (date: Date) => void;
    onEntryChange: () => void;
}


export function DayView({ client, selectedDate, entries, isLoading, onDateChange, onEntryChange }: DayViewProps) {
    const { toast } = useToast();
    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
    const [activePillar, setActivePillar] = useState<any | null>(null);
    const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isLoading || !entries || !client) return;
        const HOURLY_HEIGHT = 60;
        let targetTime: string | undefined;
        const sleepEntry = entries.find(e => e.pillar === 'sleep' && !e.isNap);
        if (sleepEntry && sleepEntry.wakeUpTime) {
            targetTime = sleepEntry.wakeUpTime;
        } else if (client.onboarding?.wakeTime) {
            targetTime = client.onboarding.wakeTime;
        }
        if (targetTime && viewportRef.current) {
            const [hours, minutes] = targetTime.split(':').map(Number);
            const targetTotalMinutes = hours * 60 + minutes - 30;
            const scrollTop = (targetTotalMinutes / 60) * HOURLY_HEIGHT;
            
            setTimeout(() => {
                if (viewportRef.current) {
                    viewportRef.current.scrollTo({
                        top: scrollTop,
                        behavior: 'smooth',
                    });
                }
            }, 0);
        }
    }, [isLoading, entries, client]);
    
    const handleSelectEntry = (entryData: any) => {
        if (entryData.pillar === 'appointment') {
            setSelectedAppointment(entryData);
            return;
        }

        const pillarId = entryData.pillar;
        const pillarConfig = pillarsAndTools.find(p => p.id === pillarId);
        if (pillarConfig) {
            setActivePillar(pillarConfig);
            setSelectedEntry(entryData);
        } else {
             toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not identify the type of this entry.',
            });
        }
    };
    
    const handleDialogClose = (wasSaved: boolean) => {
        setSelectedEntry(null);
        setActivePillar(null);
        if (wasSaved) {
            onEntryChange();
        }
    };
    
    const handleAppointmentDialogClose = (wasDeleted: boolean) => {
        setSelectedAppointment(null);
        if (wasDeleted) {
            onEntryChange();
        }
    };

    const handleDelete = async () => {
        if (!selectedEntry) return;
        const { pillar, id } = selectedEntry;
        const result = await deleteData(pillar, id, client.uid);
        if (result.success) {
            toast({ title: 'Entry Deleted' });
            handleDialogClose(true);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error, });
        }
    };

    const changeDay = (days: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        onDateChange(newDate);
    };

    const processedEntries = useMemo(() => processEntriesForLayout(entries, selectedDate), [entries, selectedDate]);
    
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div className="flex flex-col h-full">
             <div className="flex-shrink-0 p-2 flex justify-between items-center border-b">
                <Button variant="ghost" size="icon" onClick={() => changeDay(-1)}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <h3 className="text-lg font-semibold">{format(selectedDate, 'PPP')}</h3>
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
                               <TimelineEntry key={entry.id} entry={entry} onSelect={handleSelectEntry} />
                           ))}
                        </div>
                    </div>
                </ScrollArea>
            </div>
            
            {selectedEntry && activePillar && (
                <DataEntryDialog
                    open={!!selectedEntry}
                    onOpenChange={handleDialogClose}
                    pillar={activePillar}
                    initialData={selectedEntry}
                    onDelete={handleDelete}
                    userId={client.uid}
                />
            )}
            
             <AppointmentDetailDialog 
                isOpen={!!selectedAppointment}
                onClose={handleAppointmentDialogClose}
                event={selectedAppointment}
            />
        </div>
    );
}
