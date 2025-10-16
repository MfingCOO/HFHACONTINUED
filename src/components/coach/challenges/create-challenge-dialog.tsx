
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, Image as ImageIcon, PlusCircle, Trash2, Sparkles, Info, Star } from 'lucide-react';
import { format } from 'date-fns';
import { useForm, Controller, useFieldArray, useController, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { upsertChallengeAction } from '@/app/coach/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pillarsAndTools } from '@/lib/pillars';
import { Checkbox } from '@/components/ui/checkbox';
import { getCustomHabitsAction } from '@/app/coach/habits/actions';
import type { CustomHabit } from '@/types';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AppNumberInput } from '@/components/ui/number-input';


const customTaskSchema = z.object({
    description: z.string().min(1, 'Task description cannot be empty.'),
    startDay: z.coerce.number().min(1, "Start day must be at least 1."),
    unit: z.enum(['reps', 'seconds', 'minutes']),
    goalType: z.enum(['static', 'progressive', 'user-records']),
    goal: z.coerce.number().optional(),
    startingGoal: z.coerce.number().optional(),
    increaseBy: z.coerce.number().optional(),
    increaseEvery: z.enum(['week', '2-weeks', 'month']).optional(),
    notes: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.goalType === 'static') {
        if (!data.goal || data.goal <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Goal must be at least 1.",
                path: ["goal"],
            });
        }
    } else if (data.goalType === 'progressive') {
        if (!data.startingGoal || data.startingGoal <= 0) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Starting goal must be at least 1.",
                path: ["startingGoal"],
            });
        }
        if (!data.increaseBy || data.increaseBy <= 0) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Increase must be at least 1.",
                path: ["increaseBy"],
            });
        }
         if (!data.increaseEvery) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Please select a frequency.",
                path: ["increaseEvery"],
            });
        }
    }
});

const scheduledPillarSchema = z.object({
  pillarId: z.string().min(1, 'Please select a pillar.'),
  days: z.array(z.string()).min(1, 'You must select at least one day.'),
  recurrenceType: z.enum(['weekly', 'custom']),
  recurrenceInterval: z.coerce.number().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.recurrenceType === 'custom' && (!data.recurrenceInterval || data.recurrenceInterval <= 0)) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Interval must be at least 1.",
            path: ["recurrenceInterval"],
        });
    }
});

const scheduledHabitSchema = z.object({
  habitId: z.string().min(1, 'Please select a habit.'),
  days: z.array(z.string()).min(1, 'You must select at least one day.'),
  recurrenceType: z.enum(['weekly', 'custom']),
  recurrenceInterval: z.coerce.number().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.recurrenceType === 'custom' && (!data.recurrenceInterval || data.recurrenceInterval <= 0)) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Interval must be at least 1.",
            path: ["recurrenceInterval"],
        });
    }
});


const challengeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(5, 'Challenge name must be at least 5 characters.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  startDate: z.date({ required_error: "A start date is required." }),
  durationDays: z.coerce.number().min(1, 'Duration must be at least 1 day.'),
  maxParticipants: z.coerce.number().min(1, 'Must have at least one participant.'),
  thumbnailUrl: z.string().optional(),
  notes: z.string().optional(),
  scheduledPillars: z.array(scheduledPillarSchema).optional(),
  customTasks: z.array(customTaskSchema).optional(),
  scheduledHabits: z.array(scheduledHabitSchema).optional(),
}).refine(data => (data.scheduledPillars && data.scheduledPillars.length > 0) || (data.customTasks && data.customTasks.length > 0) || (data.scheduledHabits && data.scheduledHabits.length > 0), {
    message: "A challenge must have at least one pillar, custom task, or scheduled habit.",
    path: ["scheduledPillars"],
});


type ChallengeFormValues = z.infer<typeof challengeSchema>;

interface CreateChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChallengeUpserted?: () => void;
  initialData?: ChallengeFormValues | any | null; // Allow any for initial data
}


export function CreateChallengeDialog({ open, onOpenChange, onChallengeUpserted, initialData }: CreateChallengeDialogProps) {
  const { toast } = useToast();
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(initialData?.thumbnailUrl || null);
  const [customHabits, setCustomHabits] = useState<CustomHabit[]>([]);
  const isEditing = !!initialData;

  useEffect(() => {
    if (open) {
      getCustomHabitsAction().then(result => {
        if (result.success && result.data) {
          setCustomHabits(result.data);
        }
      });
    }
  }, [open]);

  const form = useForm<ChallengeFormValues>({
    resolver: zodResolver(challengeSchema),
    defaultValues: initialData ? {
        ...initialData,
        startDate: initialData.startDate ? new Date(initialData.startDate) : new Date(),
        customTasks: initialData.customTasks?.map((task: any) => ({
            description: task.description || '',
            startDay: task.startDay || 1,
            unit: task.unit || 'reps',
            goalType: task.goalType || 'static',
            goal: task.goal || undefined,
            startingGoal: task.startingGoal || undefined,
            increaseBy: task.increaseBy || undefined,
            increaseEvery: task.increaseEvery || undefined,
            notes: task.notes || '',
        })) || [],
         scheduledHabits: initialData.scheduledHabits?.map((habit: any) => ({
             ...habit,
             recurrenceType: habit.recurrenceType || 'weekly',
         })) || [],
          scheduledPillars: initialData.scheduledPillars?.map((pillar: any) => ({
             ...pillar,
             recurrenceType: pillar.recurrenceType || 'weekly',
         })) || [],
    } : {
      name: '',
      description: '',
      startDate: new Date(),
      durationDays: 7,
      maxParticipants: 100,
      notes: '',
      thumbnailUrl: '',
      scheduledPillars: [],
      customTasks: [],
      scheduledHabits: [],
    },
  });

   const { fields: scheduledPillarFields, append: appendScheduledPillar, remove: removeScheduledPillar } = useFieldArray({
    control: form.control,
    name: 'scheduledPillars'
  });

  const { fields: customTaskFields, append: appendCustomTask, remove: removeCustomTask } = useFieldArray({
    control: form.control,
    name: 'customTasks'
  });
  
  const { fields: scheduledHabitFields, append: appendScheduledHabit, remove: removeScheduledHabit } = useFieldArray({
    control: form.control,
    name: 'scheduledHabits'
  });

  const watchPillars = form.watch('scheduledPillars');
  const watchTasks = form.watch('customTasks');
  const watchHabits = form.watch('scheduledHabits');
  
  // This is the new effect hook to auto-populate notes.
  useEffect(() => {
    if (!watchHabits || customHabits.length === 0) return;
    
    watchHabits.forEach((watchedHabit, index) => {
        if(watchedHabit.habitId) {
            const habitDetails = customHabits.find(h => h.id === watchedHabit.habitId);
            const currentNotes = form.getValues(`scheduledHabits.${index}.notes`);
            // Only update if the notes field is empty or matches a previous habit's description
            // to avoid overwriting user's custom additions.
            if(habitDetails && (!currentNotes || customHabits.some(h => h.description === currentNotes))) {
                 form.setValue(`scheduledHabits.${index}.notes`, habitDetails.description, { shouldDirty: true });
            }
        }
    });
  }, [watchHabits, customHabits, form]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setThumbnailPreview(result);
        form.setValue('thumbnailUrl', result, { shouldValidate: true });
      };
      reader.readAsDataURL(file);
    }
  };


  const onSubmit = async (data: ChallengeFormValues) => {
    try {
      const result = await upsertChallengeAction(data as any); 

      if (result.success) {
        toast({ title: `Challenge ${isEditing ? 'Updated' : 'Created'}!`, description: `${data.name} has been successfully saved.` });
        onChallengeUpserted?.();
        onOpenChange(false);
        form.reset();
        setThumbnailPreview(null);
      } else {
        throw new Error(result.error?.message || 'Could not save the challenge.');
      }
    } catch (error: any) {
       console.error('Error saving challenge:', error);
       toast({ variant: 'destructive', title: 'Save Failed', description: error.message});
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] h-[90dvh] max-w-4xl flex flex-col">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                <DialogHeader className="p-6">
                    <DialogTitle>{isEditing ? 'Edit' : 'Create New'} Community Challenge</DialogTitle>
                    <DialogDescription>
                        {isEditing ? 'Update the details for this challenge.' : 'Design an engaging challenge to motivate your community.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full">
                        <div className="space-y-6 py-4 px-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Challenge Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Hydration Harmony Quest" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormDescription>Explain the goals and benefits of this challenge.</FormDescription>
                                        <FormControl>
                                            <Textarea placeholder="e.g., Track hydration to reduce cravings and boost energy!" {...field} maxLength={1000} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="startDate"
                                    render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Start Date</FormLabel>
                                        <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            initialFocus
                                            />
                                        </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="durationDays"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Duration (in days)</FormLabel>
                                            <FormControl>
                                                <AppNumberInput {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="maxParticipants"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Max Participants</FormLabel>
                                            <FormControl>
                                                <AppNumberInput {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                             {/* Scheduled Pillars */}
                            <FormItem>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <FormLabel>Scheduled Pillars</FormLabel>
                                        <FormDescription>Define which core pillars to track and when.</FormDescription>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => appendScheduledPillar({ pillarId: '', days: [], recurrenceType: 'weekly', notes: '' })}
                                    >
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Add Pillar Block
                                    </Button>
                                </div>
                                <div className="space-y-2 rounded-md border p-4">
                                     {scheduledPillarFields.length === 0 ? (
                                        <p className="text-sm text-center text-muted-foreground py-4">No scheduled pillars added yet.</p>
                                     ) : (
                                     scheduledPillarFields.map((field, index) => (
                                        <div key={field.id} className="p-3 rounded-md bg-muted/50 border space-y-3">
                                            <div className="flex justify-between items-start gap-2">
                                                <FormField control={form.control} name={`scheduledPillars.${index}.pillarId`} render={({ field }) => (
                                                    <FormItem className="flex-1">
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a pillar..."/></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {pillarsAndTools.filter(p => p.id !== 'insights').map(p => {
                                                                    const Icon = p.icon || Star;
                                                                    return (<SelectItem key={p.id} value={p.id}><span className="flex items-center gap-2"><Icon className="h-4 w-4"/> {p.label}</span></SelectItem>)
                                                                })}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <Button type="button" variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => removeScheduledPillar(index)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <FormField control={form.control} name={`scheduledPillars.${index}.days`} render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Days of the Week</FormLabel>
                                                    <FormControl>
                                                        <ToggleGroup type="multiple" variant="outline" size="sm" className="justify-start gap-1" value={field.value} onValueChange={field.onChange}>
                                                            <ToggleGroupItem value="sun">S</ToggleGroupItem>
                                                            <ToggleGroupItem value="mon">M</ToggleGroupItem>
                                                            <ToggleGroupItem value="tue">T</ToggleGroupItem>
                                                            <ToggleGroupItem value="wed">W</ToggleGroupItem>
                                                            <ToggleGroupItem value="thu">T</ToggleGroupItem>
                                                            <ToggleGroupItem value="fri">F</ToggleGroupItem>
                                                            <ToggleGroupItem value="sat">S</ToggleGroupItem>
                                                        </ToggleGroup>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField control={form.control} name={`scheduledPillars.${index}.recurrenceType`} render={({ field }) => (
                                                    <FormItem className="space-y-2">
                                                        <FormLabel className="text-xs">Recurrence</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select recurrence..."/></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="weekly">Weekly</SelectItem>
                                                                <SelectItem value="custom">Custom Interval</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name={`scheduledPillars.${index}.recurrenceInterval`} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Repeat every (days)</FormLabel>
                                                        <FormControl>
                                                            <AppNumberInput
                                                                placeholder="e.g., 14"
                                                                disabled={watchPillars?.[index]?.recurrenceType !== 'custom'}
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}/>
                                            </div>
                                             <FormField control={form.control} name={`scheduledPillars.${index}.notes`} render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Notes/Instructions</FormLabel>
                                                    <FormControl><Textarea placeholder="e.g., Focus on hitting your protein goal today." {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}/>
                                        </div>
                                     ))
                                     )}
                                </div>
                            </FormItem>


                             {/* Scheduled Habits */}
                            <FormItem>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <FormLabel>Scheduled Habits</FormLabel>
                                        <FormDescription>Define recurring weekly habits for this challenge.</FormDescription>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => appendScheduledHabit({ habitId: '', days: [], recurrenceType: 'weekly', notes: '' })}
                                    >
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Add Habit Block
                                    </Button>
                                </div>
                                <div className="space-y-2 rounded-md border p-4">
                                     {scheduledHabitFields.length === 0 ? (
                                        <p className="text-sm text-center text-muted-foreground py-4">No scheduled habits added yet.</p>
                                     ) : (
                                     scheduledHabitFields.map((field, index) => (
                                        <div key={field.id} className="p-3 rounded-md bg-muted/50 border space-y-3">
                                            <div className="flex justify-between items-start gap-2">
                                                <FormField control={form.control} name={`scheduledHabits.${index}.habitId`} render={({ field }) => (
                                                    <FormItem className="flex-1">
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a habit..."/></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {customHabits.map(habit => <SelectItem key={habit.id} value={habit.id}>{habit.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <Button type="button" variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => removeScheduledHabit(index)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <FormField control={form.control} name={`scheduledHabits.${index}.days`} render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Days of the Week</FormLabel>
                                                    <FormControl>
                                                        <ToggleGroup type="multiple" variant="outline" size="sm" className="justify-start gap-1" value={field.value} onValueChange={field.onChange}>
                                                            <ToggleGroupItem value="sun">S</ToggleGroupItem>
                                                            <ToggleGroupItem value="mon">M</ToggleGroupItem>
                                                            <ToggleGroupItem value="tue">T</ToggleGroupItem>
                                                            <ToggleGroupItem value="wed">W</ToggleGroupItem>
                                                            <ToggleGroupItem value="thu">T</ToggleGroupItem>
                                                            <ToggleGroupItem value="fri">F</ToggleGroupItem>
                                                            <ToggleGroupItem value="sat">S</ToggleGroupItem>
                                                        </ToggleGroup>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField control={form.control} name={`scheduledHabits.${index}.recurrenceType`} render={({ field }) => (
                                                    <FormItem className="space-y-2">
                                                        <FormLabel className="text-xs">Recurrence</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select recurrence..."/></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="weekly">Weekly</SelectItem>
                                                                <SelectItem value="custom">Custom Interval</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name={`scheduledHabits.${index}.recurrenceInterval`} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Repeat every (days)</FormLabel>
                                                        <FormControl>
                                                        <AppNumberInput
                                                            placeholder="e.g., 14"
                                                            disabled={watchHabits?.[index]?.recurrenceType !== 'custom'}
                                                            {...field}
                                                        />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}/>
                                            </div>
                                            <FormField control={form.control} name={`scheduledHabits.${index}.notes`} render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Notes/Instructions</FormLabel>
                                                    <FormControl><Textarea placeholder="e.g., Take a moment to reflect on why this habit is important to you." {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}/>
                                        </div>
                                     ))
                                     )}
                                </div>
                            </FormItem>
                            
                            {/* Daily Tasks */}
                            <FormItem>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <FormLabel>Custom Daily Exercises</FormLabel>
                                        <FormDescription>Define specific, measurable exercises for this challenge.</FormDescription>
                                    </div>
                                        <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => appendCustomTask({ description: '', startDay: 1, unit: 'reps', goalType: 'static', goal: 10, notes: '' })}
                                    >
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Add Exercise
                                    </Button>
                                </div>
                                <div className="space-y-2 rounded-md border p-4">
                                    {customTaskFields.length === 0 ? (
                                        <p className="text-sm text-center text-muted-foreground py-4">No custom exercises added yet.</p>
                                    ) : (
                                    customTaskFields.map((field, index) => (
                                        <div key={field.id} className="flex flex-col gap-2 p-2 rounded-md bg-muted/50 border">
                                                <div className="flex justify-end">
                                                    <Button type="button" variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => removeCustomTask(index)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                </div>

                                            <div className="space-y-3">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <FormField control={form.control} name={`customTasks.${index}.description`} render={({ field }) => (
                                                        <FormItem><FormLabel className="text-xs">Description</FormLabel><FormControl><Input placeholder="e.g., Push Ups" {...field} /></FormControl><FormMessage /></FormItem>
                                                    )} />
                                                    <FormField control={form.control} name={`customTasks.${index}.startDay`} render={({ field }) => (
                                                        <FormItem><FormLabel className="text-xs">Start Day</FormLabel><FormControl><AppNumberInput placeholder="1" {...field} /></FormControl><FormMessage /></FormItem>
                                                    )} />
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <FormField control={form.control} name={`customTasks.${index}.unit`} render={({ field }) => (
                                                        <FormItem><FormLabel className="text-xs">Unit</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <FormControl><SelectTrigger><SelectValue placeholder="Unit"/></SelectTrigger></FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="reps">Reps</SelectItem>
                                                                    <SelectItem value="seconds">Seconds</SelectItem>
                                                                    <SelectItem value="minutes">Minutes</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        <FormMessage /></FormItem>
                                                    )} />
                                                    <FormField control={form.control} name={`customTasks.${index}.goalType`} render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-xs">Goal Type</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <FormControl><SelectTrigger><SelectValue placeholder="Select goal type..." /></SelectTrigger></FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="static">Static Goal</SelectItem>
                                                                    <SelectItem value="progressive">Progressive Goal</SelectItem>
                                                                    <SelectItem value="user-records">User Records</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                </div>
                                                
                                                    {watchTasks && watchTasks[index]?.goalType === 'static' && (
                                                    <FormField control={form.control} name={`customTasks.${index}.goal`} render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-xs">Goal</FormLabel>
                                                            <FormControl><AppNumberInput {...field} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                )}

                                                {watchTasks && watchTasks[index]?.goalType === 'progressive' && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                        <FormField control={form.control} name={`customTasks.${index}.startingGoal`} render={({ field }) => (
                                                            <FormItem><FormLabel className="text-xs">Starting Goal</FormLabel><FormControl><AppNumberInput {...field} /></FormControl><FormMessage /></FormItem>
                                                        )} />
                                                        <FormField control={form.control} name={`customTasks.${index}.increaseBy`} render={({ field }) => (
                                                            <FormItem><FormLabel className="text-xs">Increase By</FormLabel><FormControl><AppNumberInput {...field} /></FormControl><FormMessage /></FormItem>
                                                        )} />
                                                        <FormField control={form.control} name={`customTasks.${index}.increaseEvery`} render={({ field }) => (
                                                            <FormItem><FormLabel className="text-xs">Increase Every</FormLabel>
                                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                    <FormControl><SelectTrigger><SelectValue placeholder="Frequency"/></SelectTrigger></FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="week">Week</SelectItem>
                                                                        <SelectItem value="2-weeks">2 Weeks</SelectItem>
                                                                            <SelectItem value="month">Month</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            <FormMessage /></FormItem>
                                                        )} />
                                                    </div>
                                                )}
                                                <FormField control={form.control} name={`customTasks.${index}.notes`} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Modification Notes</FormLabel>
                                                        <FormControl><Textarea placeholder="e.g., If this is too hard, try knee push-ups." {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}/>
                                            </div>
                                        </div>
                                    ))
                                    )}
                                </div>
                            </FormItem>

                            {/* Thumbnail */}
                            <div className="space-y-2">
                                <Label>Challenge Thumbnail</Label>
                                <FormDescription>Upload a thumbnail image for the challenge.</FormDescription>
                                <div className="p-4 border rounded-md space-y-4">
                                <FormField
                                    control={form.control}
                                    name="thumbnailUrl"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={handleFileSelect} 
                                                className="file:text-primary file:font-semibold"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                {thumbnailPreview ? (
                                        <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                                            <Image src={thumbnailPreview} alt="Thumbnail preview" fill className="object-cover" unoptimized />
                                        </div>
                                ) : (
                                    <div className="w-full h-40 rounded-lg bg-muted flex items-center justify-center">
                                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                                    </div>
                                )}
                                </div>
                            </div>

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Schedule & Instructions</FormLabel>
                                        <FormDescription>Explain how the tasks should be performed (e.g., daily, or escalating weekly).</FormDescription>
                                        <FormControl>
                                            <Textarea placeholder="e.g., Week 1: Perform as written.&#10;Week 2: Double all reps." {...field} maxLength={1000}/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter className="pt-4 border-t mt-4 flex-shrink-0">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                         {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? 'Update Challenge' : 'Create Challenge'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
