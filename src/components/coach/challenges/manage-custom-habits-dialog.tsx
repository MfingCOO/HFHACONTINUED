
'use client';

import {
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback } from 'react';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { saveCustomHabitAction, getCustomHabitsAction, deleteCustomHabitAction } from '@/app/coach/habits/actions';
import type { CustomHabit } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CoachPageModal } from '@/components/ui/coach-page-modal';

interface ManageCustomHabitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const habitFormSchema = z.object({
  name: z.string().min(3, 'Habit name must be at least 3 characters.'),
  description: z.string().min(5, 'Description must be at least 5 characters.'),
});

export function ManageCustomHabitsDialog({ open, onOpenChange }: ManageCustomHabitsDialogProps) {
  const { toast } = useToast();
  const [habits, setHabits] = useState<CustomHabit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteAlert, setDeleteAlert] = useState<{ open: boolean; habit: CustomHabit | null }>({ open: false, habit: null });
  
  const form = useForm<z.infer<typeof habitFormSchema>>({
    resolver: zodResolver(habitFormSchema),
    defaultValues: { name: '', description: '' },
  });

  const fetchHabits = useCallback(async () => {
    setIsLoading(true);
    const result = await getCustomHabitsAction();
    if (result.success && result.data) {
      setHabits(result.data);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch custom habits.' });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (open) {
      fetchHabits();
    }
  }, [open, fetchHabits]);

  const onSubmit = async (values: z.infer<typeof habitFormSchema>) => {
    const result = await saveCustomHabitAction(values);
    if (result.success) {
      toast({ title: 'Habit Saved!', description: `${values.name} has been added to your library.` });
      form.reset();
      fetchHabits();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const handleDelete = async () => {
    if (!deleteAlert.habit) return;
    setIsDeleting(deleteAlert.habit.id);
    const result = await deleteCustomHabitAction(deleteAlert.habit.id);
    if (result.success) {
      toast({ title: 'Habit Deleted' });
      fetchHabits();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsDeleting(null);
    setDeleteAlert({ open: false, habit: null });
  };

  return (
    <>
      <CoachPageModal
        open={open}
        onOpenChange={onOpenChange}
        title="Manage Custom Habits"
        description="Create and manage reusable habits for your challenges."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            <div className="flex flex-col gap-4">
              <h3 className="font-semibold text-lg">Create New Habit</h3>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Habit Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Mindful Eating" {...field} />
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
                        <FormControl>
                          <Textarea placeholder="Describe the purpose of this habit..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Save Habit
                  </Button>
                </form>
              </Form>
            </div>
            <div className="flex flex-col border rounded-lg">
               <h3 className="font-semibold text-lg p-4 border-b">Habit Library</h3>
                <div className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                      <div className="p-4 space-y-2">
                      {isLoading ? (
                          <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
                      ) : habits.length > 0 ? (
                          habits.map(habit => (
                          <div key={habit.id} className="flex items-start justify-between gap-2 rounded-md border p-2">
                              <div className="flex-1">
                                  <p className="font-semibold text-sm">{habit.name}</p>
                                  <p className="text-xs text-muted-foreground">{habit.description}</p>
                              </div>
                              <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 flex-shrink-0"
                                  onClick={() => setDeleteAlert({ open: true, habit })}
                                  disabled={isDeleting === habit.id}
                              >
                                  {isDeleting === habit.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                              </Button>
                          </div>
                          ))
                      ) : (
                          <p className="text-sm text-center text-muted-foreground py-10">No custom habits created yet.</p>
                      )}
                      </div>
                  </ScrollArea>
                </div>
            </div>
          </div>
      </CoachPageModal>
       <AlertDialog open={deleteAlert.open} onOpenChange={() => setDeleteAlert({ open: false, habit: null })}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the habit "{deleteAlert.habit?.name}". This action cannot be undone.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={!!isDeleting}>
                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete Habit
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
