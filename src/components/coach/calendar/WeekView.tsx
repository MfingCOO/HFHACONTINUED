
'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, Briefcase, User, ZoomIn } from 'lucide-react';
import { startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays, format, isToday, differenceInMinutes, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';


interface WeekViewProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  events: any[];
  isLoading: boolean;
  onEventClick: (event: any) => void;
  onDayClick: (date: Date) => void;
}

const hours = Array.from({ length: 14 }, (_, i) => i + 6); // 6 AM to 7 PM

const eventColors: Record<string, string> = {
    personal: 'bg-blue-500/80 border-blue-700',
    manual: 'bg-green-500/80 border-green-700',
    zoom: 'bg-primary/80 border-primary/90',
    default: 'bg-gray-500/80 border-gray-700',
};


const TimelineEvent = ({ event, onEventClick }: { event: any, onEventClick: (event: any) => void }) => {
    const dayStart = startOfDay(new Date(event.start));
    const startMinutes = differenceInMinutes(new Date(event.start), dayStart);
    const endMinutes = differenceInMinutes(new Date(event.end), dayStart);

    // Calculate position and height relative to the 6 AM to 8 PM view
    const viewStartMinutes = 6 * 60;
    const viewTotalMinutes = 14 * 60;
    
    const top = ((startMinutes - viewStartMinutes) / viewTotalMinutes) * 100;
    const height = ((endMinutes - startMinutes) / viewTotalMinutes) * 100;

    let Icon, colorClass;
    if (event.isPersonal) {
        Icon = Briefcase;
        colorClass = eventColors.personal;
    } else if (event.attendees) {
        Icon = ZoomIn;
        colorClass = eventColors.zoom;
    } else {
        Icon = User;
        colorClass = eventColors.manual;
    }

    if (top < 0 || top > 100) return null; // Don't render events outside the visible time range

    return (
        <div
            style={{ top: `${top}%`, height: `${height}%` }}
            className={cn("absolute w-full p-0.5 rounded-md overflow-hidden cursor-pointer", colorClass)}
            onClick={() => onEventClick(event)}
        >
             <div className="relative flex items-center gap-1 p-1 text-white h-full">
                <Icon className="h-3 w-3 flex-shrink-0" />
                <span className="text-[10px] font-medium truncate">{event.title}</span>
            </div>
        </div>
    )
}

export function WeekView({ currentDate, setCurrentDate, events, isLoading, onEventClick, onDayClick }: WeekViewProps) {
  const week = useMemo(() => eachDayOfInterval({
    start: startOfWeek(currentDate),
    end: endOfWeek(currentDate),
  }), [currentDate]);

  const changeWeek = (direction: 'next' | 'prev') => {
    const newDate = direction === 'next' ? addDays(currentDate, 7) : subDays(currentDate, 7);
    setCurrentDate(newDate);
  };

  const eventsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const event of events) {
      const eventDateStr = format(new Date(event.start), 'yyyy-MM-dd');
      if (!map.has(eventDateStr)) {
        map.set(eventDateStr, []);
      }
      map.get(eventDateStr)!.push(event);
    }
    return map;
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-2 border-b flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => changeWeek('prev')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-base font-semibold">
          {format(week[0], 'MMM d')} - {format(week[6], 'MMM d, yyyy')}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => changeWeek('next')}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

       <div className="flex flex-col flex-1 min-h-0">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr] flex-shrink-0 sticky top-0 bg-background z-10">
                <div className="w-12 border-r" />
                {week.map(day => (
                    <button 
                        key={day.toString()}
                        onClick={() => onDayClick(day)}
                        className={cn(
                            "flex flex-col items-center p-1 border-b border-r text-center hover:bg-muted/50",
                             isToday(day) && "bg-primary/10"
                        )}
                    >
                         <span className={cn('text-xs font-semibold', isToday(day) ? 'text-primary' : 'text-muted-foreground')}>
                            {format(day, 'EEE')}
                        </span>
                        <span className={cn(
                            'flex items-center justify-center h-6 w-6 rounded-full text-sm font-bold',
                            isToday(day) && 'bg-primary text-primary-foreground'
                        )}>
                            {format(day, 'd')}
                        </span>
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
             <ScrollArea className="flex-1">
                 <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr] relative">
                    {/* Hour Labels */}
                    <div className="w-12">
                        {hours.map(hour => (
                            <div key={hour} className="h-16 text-right pr-1 border-r -translate-y-2">
                                <span className="text-[10px] text-muted-foreground">{format(new Date(0,0,0,hour), 'ha')}</span>
                            </div>
                        ))}
                    </div>

                    {/* Day Columns */}
                    {week.map(day => {
                        const dayKey = format(day, 'yyyy-MM-dd');
                        const dayEvents = eventsByDay.get(dayKey) || [];

                        return (
                             <div key={dayKey} className="relative border-r">
                                {hours.map(hour => <div key={hour} className="h-16 border-b" />)}
                                {dayEvents.map(event => (
                                    <TimelineEvent key={event.id} event={event} onEventClick={onEventClick} />
                                ))}
                            </div>
                        )
                    })}
                </div>
            </ScrollArea>
            )}
        </div>
    </div>
  );
}
