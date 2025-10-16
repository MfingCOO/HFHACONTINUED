
'use client';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Briefcase, User, ZoomIn } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isToday,
  isSameMonth,
  format,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { cn } from '@/lib/utils';

interface MonthViewProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  events: any[];
  isLoading: boolean;
  onEventClick: (event: any) => void;
  onDayClick: (date: Date) => void;
}

export function MonthView({ currentDate, setCurrentDate, events, isLoading, onEventClick, onDayClick }: MonthViewProps) {
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  
  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({ 
      start: startOfWeek(monthStart), 
      end: endOfWeek(endOfMonth(monthStart)) 
    });
  }, [monthStart]);

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
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-base font-semibold">
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 flex-shrink-0">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-semibold text-muted-foreground p-2 border-b border-r">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
        {daysInMonth.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(dayKey) || [];
          return (
            <button
              key={dayKey}
              onClick={() => onDayClick(day)}
              className={cn(
                "relative border-b border-r p-1.5 flex flex-col gap-1 overflow-y-auto text-left hover:bg-muted/50 transition-colors",
                !isSameMonth(day, currentDate) && 'bg-muted/30'
              )}
            >
              <span className={cn(
                'text-xs font-semibold',
                isToday(day) ? 'bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center' : 'text-muted-foreground'
              )}>
                {format(day, 'd')}
              </span>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(event => {
                  let Icon;
                  let bgClass;
                  if(event.isPersonal) {
                      Icon = Briefcase;
                      bgClass = 'bg-blue-500/20 text-blue-300';
                  } else if (event.attendees) {
                      Icon = ZoomIn;
                      bgClass = 'bg-primary/20 text-primary';
                  } else {
                      Icon = User;
                      bgClass = 'bg-green-500/20 text-green-300';
                  }
                  return (
                      <div key={event.id} className={cn("w-full text-left text-xs p-1 rounded-md flex items-start gap-1.5 pointer-events-none", bgClass)}>
                          <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{event.title}</p>
                              <p className="truncate opacity-80">{format(new Date(event.start), 'p')}</p>
                          </div>
                      </div>
                  )
                })}
                {dayEvents.length > 2 && (
                    <div className="text-center text-xs text-muted-foreground pt-1">+ {dayEvents.length - 2} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  )
}
