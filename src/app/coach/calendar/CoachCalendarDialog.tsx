
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCoachEvents } from '@/app/coach/calendar/actions';
import { DayView } from '@/components/coach/calendar/DayView';
import { WeekView } from '@/components/coach/calendar/WeekView';
import { MonthView } from '@/components/coach/calendar/MonthView';
import { EventDialog } from '@/components/coach/calendar/EventDialog';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay as dateFnsEndOfDay } from 'date-fns';
import { X, CalendarPlus, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { AvailabilityDialog } from '@/components/coach/calendar/AvailabilityDialog';

interface CoachCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoachCalendarDialog({ open, onOpenChange }: CoachCalendarDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'day' | 'week' | 'month'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const fetchEvents = useCallback(async (date: Date, view: 'day' | 'week' | 'month') => {
    setIsLoading(true);
    let startDate, endDate;

    if (view === 'month') {
        startDate = startOfMonth(date);
        endDate = endOfMonth(date);
    } else if (view === 'week') {
        startDate = startOfWeek(date);
        endDate = endOfWeek(date);
    } else { // day
        startDate = startOfDay(date);
        endDate = dateFnsEndOfDay(date);
    }

    try {
      const result = await getCoachEvents(startDate, endDate);
      if (result.success && result.data) {
        setEvents(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch events');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      fetchEvents(currentDate, activeTab);
    }
  }, [open, currentDate, activeTab, fetchEvents]);

  const handleEventClick = (event: any) => {
    setSelectedEvent(event);
    setIsEventDialogOpen(true);
  };
  
  const handleMakeAppointment = () => {
    setSelectedEvent(null); // Clear any previously selected event
    setIsEventDialogOpen(true);
  }
  
  const handleDayClick = (date: Date) => {
      setCurrentDate(date);
      setActiveTab('day');
  }

  const handleEventDialogClose = (wasSaved: boolean) => {
    setIsEventDialogOpen(false);
    setSelectedEvent(null);
    if (wasSaved) {
      fetchEvents(currentDate, activeTab); // Refetch events if something was saved
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[90vw] max-w-7xl h-[90dvh] flex flex-col p-0">
          <DialogHeader className="p-2 border-b flex flex-row items-center justify-between">
             <DialogTitle srOnly>Coach Calendar</DialogTitle>
            <div className="flex items-center gap-2">
                <Button onClick={() => setIsAvailabilityOpen(true)} size="sm" variant="outline">
                    <Settings className="h-4 w-4 mr-2"/>
                    Set Availability
                </Button>
                 <Button onClick={handleMakeAppointment} size="sm">
                    <CalendarPlus className="h-4 w-4 mr-2"/>
                    Appointment
                </Button>
            </div>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1 flex flex-col min-h-0">
            <div className="px-2 py-1 border-b">
                <TabsList className="grid w-full grid-cols-3 max-w-xs mx-auto">
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
            </div>
            <div className="flex-1 min-h-0">
                <TabsContent value="day" className="h-full m-0">
                    <DayView 
                        currentDate={currentDate} 
                        setCurrentDate={setCurrentDate} 
                        events={events} 
                        isLoading={isLoading} 
                        onEventClick={handleEventClick}
                        onDayClick={handleDayClick}
                    />
                </TabsContent>
                <TabsContent value="week" className="h-full m-0">
                    <WeekView 
                         currentDate={currentDate} 
                         setCurrentDate={setCurrentDate} 
                         events={events} 
                         isLoading={isLoading} 
                         onEventClick={handleEventClick}
                         onDayClick={handleDayClick}
                    />
                </TabsContent>
                <TabsContent value="month" className="h-full m-0">
                    <MonthView 
                        currentDate={currentDate} 
                        setCurrentDate={setCurrentDate} 
                        events={events} 
                        isLoading={isLoading} 
                        onEventClick={handleEventClick}
                        onDayClick={handleDayClick}
                    />
                </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      <EventDialog
        isOpen={isEventDialogOpen}
        onClose={handleEventDialogClose}
        event={selectedEvent}
      />

      <AvailabilityDialog
        open={isAvailabilityOpen}
        onOpenChange={setIsAvailabilityOpen}
      />
    </>
  );
}
