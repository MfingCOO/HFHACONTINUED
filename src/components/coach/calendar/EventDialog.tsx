
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Loader2, Trash2, Calendar as CalendarIcon, Link as LinkIcon } from 'lucide-react';
import { saveCalendarEvent, deleteCalendarEvent } from '@/app/coach/calendar/actions';
import { getClientsForCoach } from '@/app/coach/dashboard/actions';
import type { ClientProfile } from '@/types';
import { Combobox } from '@/components/ui/combobox';
import { format, addDays } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/components/auth/auth-provider';

// Simplified schema, removing recurring event fields
const eventSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Title is required."),
    start: z.date(),
    description: z.string().optional(),
    clientId: z.string().optional().nullable(),
    clientName: z.string().optional().nullable(),
    isPersonal: z.boolean().default(false),
    attachVideoLink: z.boolean().default(false),
    
    durationDays: z.coerce.number().min(0).optional(),
    durationHours: z.coerce.number().min(0).optional(),
    durationMinutes: z.coerce.number().min(0).optional(),
});

type EventFormValues = z.infer<typeof eventSchema>;

interface EventDialogProps {
  isOpen: boolean;
  onClose: (wasSaved: boolean) => void;
  event: any | null;
}

export function EventDialog({ isOpen, onClose, event }: EventDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      start: new Date(),
      durationDays: 0,
      durationHours: 1,
      durationMinutes: 0,
      description: '',
      clientId: null,
      clientName: null,
      isPersonal: false,
      attachVideoLink: false,
    },
  });

  useEffect(() => {
    if (isOpen) {
      getClientsForCoach().then(result => {
        if (result.success && result.data) {
          const eligibleClients = result.data.filter(c => c.tier === 'premium' || c.tier === 'coaching');
          setClients(eligibleClients as ClientProfile[]);
        }
      });
      
      if (event) {
        // Editing an existing event
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        const diffMs = endDate.getTime() - startDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        const days = Math.floor(diffMins / 1440);
        const hours = Math.floor((diffMins % 1440) / 60);
        const minutes = diffMins % 60;
        
        form.reset({
          id: event.id,
          title: event.title || '',
          start: startDate,
          durationDays: days,
          durationHours: hours,
          durationMinutes: minutes,
          description: event.description || '',
          clientId: event.clientId || null,
          clientName: event.clientName || null,
          isPersonal: event.isPersonal || false,
          attachVideoLink: !!event.videoCallLink,
        });
      } else {
        // Creating a new event
        form.reset({
          id: undefined,
          title: '',
          start: new Date(),
          durationDays: 0,
          durationHours: 1,
          durationMinutes: 0,
          description: '',
          clientId: null,
          clientName: null,
          isPersonal: false,
          attachVideoLink: false,
        });
      }
    }
  }, [isOpen, event, form]);

  const onSubmit = async (values: EventFormValues) => {
    setIsLoading(true);
    const end = new Date(values.start);
    end.setDate(end.getDate() + (values.durationDays || 0));
    end.setHours(end.getHours() + (values.durationHours || 0));
    end.setMinutes(end.getMinutes() + (values.durationMinutes || 0));

    try {
        const client = clients.find(c => c.uid === values.clientId);
        const dataToSave = {
            ...values,
            end,
            clientName: client?.fullName || null,
            coachId: user?.uid,
            coachName: user?.displayName,
        };
        const result = await saveCalendarEvent(dataToSave as any);
        if (result.success) {
            toast({ title: 'Success!', description: `Appointment has been ${values.id ? 'updated' : 'created'}.` });
            onClose(true);
        } else {
            throw new Error(result.error || 'An unknown error occurred.');
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    setIsLoading(true);
    try {
        const result = await deleteCalendarEvent(event.id);
        if(result.success) {
            toast({ title: 'Event Deleted' });
            onClose(true);
        } else {
             throw new Error(result.error || 'Failed to delete event.');
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsLoading(false);
    }
  }

  const clientOptions = clients.map(c => ({
      value: c.uid,
      label: `${c.fullName} (${c.email})`
  }));
  
  const isPersonal = form.watch('isPersonal');

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose(false)}>
      <DialogContent className="w-[90vw] max-w-lg h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{event?.id ? 'Edit Event' : 'Make Appointment'}</DialogTitle>
           {event?.id ? <DialogDescription>Update the details for this event.</DialogDescription> : <DialogDescription>Create a new event on your calendar.</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="px-6 pb-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} id="event-form" className="space-y-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                        <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                      <FormField control={form.control} name="start" render={({ field }) => (
                          <FormItem className="flex-1 flex flex-col">
                              <FormLabel>Start Time</FormLabel>
                                <div className="flex gap-2">
                                  <Input 
                                      type="date" 
                                      value={format(field.value, "yyyy-MM-dd")} 
                                      onChange={e => {
                                          const newDate = new Date(e.target.value);
                                          const timezoneOffset = newDate.getTimezoneOffset() * 60000;
                                          const adjustedDate = new Date(newDate.getTime() + timezoneOffset);
                                          const finalDate = new Date(field.value);
                                          finalDate.setFullYear(adjustedDate.getFullYear(), adjustedDate.getMonth(), adjustedDate.getDate());
                                          field.onChange(finalDate);
                                      }}
                                  />
                                  <Input 
                                      type="time" 
                                      value={format(field.value, "HH:mm")} 
                                      onChange={e => {
                                          const [hours, minutes] = e.target.value.split(':').map(Number);
                                          const newDate = new Date(field.value);
                                          newDate.setHours(hours, minutes);
                                          field.onChange(newDate);
                                      }}
                                  />
                                </div>
                          <FormMessage /></FormItem>
                      )} />

                      <div className="flex items-end gap-1">
                          <FormField control={form.control} name="durationDays" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Days</FormLabel><FormControl><Input className="w-16" type="number" {...field} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="durationHours" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Hrs</FormLabel><FormControl><Input className="w-16" type="number" {...field} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="durationMinutes" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Min</FormLabel><FormControl><Input className="w-16" type="number" {...field} /></FormControl></FormItem>
                          )} />
                      </div>
                  </div>

                  <FormField control={form.control} name="isPersonal" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5"><FormLabel>Personal Event</FormLabel><FormDescription className="text-xs">Mark this if it's a personal appointment.</FormDescription></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                  )} />

                  {!isPersonal && (
                      <div className="space-y-3">
                        <FormField control={form.control} name="clientId" render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Client (Optional)</FormLabel>
                                <div className="w-full max-w-sm">
                                    <Combobox
                                        options={clientOptions}
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                        placeholder="Select a client..."
                                        searchPlaceholder="Search clients..."
                                        modal={true}
                                    />
                                </div>
                                <FormDescription className="text-xs">Link this appointment to a specific client.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="attachVideoLink" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel className="flex items-center gap-2"><LinkIcon className="h-4 w-4"/>Attach Default Video Link</FormLabel>
                                    <FormDescription className="text-xs">Add your saved video call link to this event.</FormDescription>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                      </div>
                  )}

                  <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem><FormLabel>Description / Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  
                </form>
              </Form>
            </div>
          </ScrollArea>
        </div>
        <DialogFooter className="p-6 pt-2 flex justify-between w-full border-t">
            <div>
                 {event?.id && (
                     <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isLoading}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                     </Button>
                 )}
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => onClose(false)}>Cancel</Button>
                <Button type="submit" form="event-form" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {event?.id ? 'Save Changes' : 'Create Event'}
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
