
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
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Loader2, PlusCircle, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { saveCoachAvailability } from '@/app/coach/calendar/actions';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CoachPageModal } from '@/components/ui/coach-page-modal';

const availabilitySchema = z.object({
  weekly: z.array(z.object({
    day: z.string(),
    enabled: z.boolean(),
    slots: z.array(z.object({
      start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    })),
  })).length(7),
  vacationBlocks: z.array(z.object({
    start: z.date(),
    end: z.date(),
    notes: z.string().optional(),
  })).optional(),
});

type AvailabilityFormValues = z.infer<typeof availabilitySchema>;

interface AvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AvailabilityDialog({ open, onOpenChange }: AvailabilityDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      weekly: [
        { day: 'Sunday', enabled: false, slots: [] },
        { day: 'Monday', enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
        { day: 'Tuesday', enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
        { day: 'Wednesday', enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
        { day: 'Thursday', enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
        { day: 'Friday', enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
        { day: 'Saturday', enabled: false, slots: [] },
      ],
      vacationBlocks: [],
    },
  });
  
  const { fields: vacationFields, append: appendVacation, remove: removeVacation } = useFieldArray({
    control: form.control,
    name: 'vacationBlocks',
  });

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      getSiteSettingsAction().then(result => {
        if (result.success && result.data?.availability) {
          form.reset({
            ...result.data.availability,
            vacationBlocks: result.data.availability.vacationBlocks?.map(block => ({
                ...block,
                start: new Date(block.start),
                end: new Date(block.end),
            })) || []
          });
        }
        setIsLoading(false);
      });
    }
  }, [open, form]);

  const onSubmit = async (values: AvailabilityFormValues) => {
    setIsLoading(true);
    try {
        const result = await saveCoachAvailability(values as any);
        if (result.success) {
            toast({ title: 'Availability Saved!', description: 'Your schedule has been updated.' });
            onOpenChange(false);
        } else {
            throw new Error(result.error);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  const formContent = (
     <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} id="availability-form" className="space-y-6 p-1">
        <div>
            <h3 className="text-lg font-semibold mb-2">Weekly Schedule</h3>
            <div className="space-y-3">
            {form.getValues('weekly').map((day, dayIndex) => (
                <div key={day.day} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                    <FormLabel>{day.day}</FormLabel>
                    <FormField
                    control={form.control}
                    name={`weekly.${dayIndex}.enabled`}
                    render={({ field }) => (
                        <FormItem>
                        <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        </FormItem>
                    )}
                    />
                </div>
                {form.watch(`weekly.${dayIndex}.enabled`) && (
                    <div className="space-y-2 mt-2 pt-2 border-t">
                        {(form.watch(`weekly.${dayIndex}.slots`) || []).map((slot, slotIndex) => (
                        <div key={slotIndex} className="flex items-center gap-2">
                            <FormField
                            control={form.control}
                            name={`weekly.${dayIndex}.slots.${slotIndex}.start`}
                            render={({ field }) => <FormItem className="flex-1"><FormControl><Input type="time" {...field} /></FormControl></FormItem>}
                            />
                            <span>-</span>
                            <FormField
                            control={form.control}
                            name={`weekly.${dayIndex}.slots.${slotIndex}.end`}
                            render={({ field }) => <FormItem className="flex-1"><FormControl><Input type="time" {...field} /></FormControl></FormItem>}
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                const slots = form.getValues(`weekly.${dayIndex}.slots`);
                                form.setValue(`weekly.${dayIndex}.slots`, slots.filter((_, i) => i !== slotIndex));
                            }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        ))}
                        <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => {
                            const slots = form.getValues(`weekly.${dayIndex}.slots`) || [];
                            form.setValue(`weekly.${dayIndex}.slots`, [...slots, { start: '09:00', end: '17:00' }]);
                        }}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Time Slot
                        </Button>
                    </div>
                )}
                </div>
            ))}
            </div>
        </div>
        <Separator/>
        <div>
            <h3 className="text-lg font-semibold mb-2">Vacations / Time Off</h3>
                <div className="space-y-2">
                {vacationFields.map((field, index) => (
                    <div key={field.id} className="p-3 border rounded-lg space-y-2">
                        <div className="flex justify-end">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeVacation(index)} className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                                <FormField
                                control={form.control}
                                name={`vacationBlocks.${index}.start`}
                                render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>Start Date</FormLabel>
                                <Popover><PopoverTrigger asChild><FormControl>
                                    <Button variant="outline" className="justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value ? format(field.value, "MM/dd/yy") : <span>Pick a date</span>}
                                    </Button>
                                </FormControl></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                </Popover><FormMessage /></FormItem>
                            )} />
                                <FormField
                                control={form.control}
                                name={`vacationBlocks.${index}.end`}
                                render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>End Date</FormLabel>
                                <Popover><PopoverTrigger asChild><FormControl>
                                    <Button variant="outline" className="justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value ? format(field.value, "MM/dd/yy") : <span>Pick a date</span>}
                                    </Button>
                                </FormControl></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                </Popover><FormMessage /></FormItem>
                            )} />
                        </div>
                            <FormField
                            control={form.control}
                            name={`vacationBlocks.${index}.notes`}
                            render={({ field }) => (
                                <FormItem><FormLabel>Notes</FormLabel><FormControl><Input placeholder="e.g., Holiday Break" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </div>
                ))}
                    <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => appendVacation({ start: new Date(), end: new Date(), notes: '' })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Vacation Block
                </Button>
            </div>
        </div>
        </form>
    </Form>
  );

  return (
      <CoachPageModal
        open={open}
        onOpenChange={onOpenChange}
        title="Set Shared Availability"
        description="Define the standard working hours and vacation days for all coaches."
        footer={
            <div className="flex justify-between w-full">
                 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" form="availability-form" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Availability
                </Button>
            </div>
        }
      >
        {formContent}
      </CoachPageModal>
  );
}
