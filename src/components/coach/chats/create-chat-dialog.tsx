
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
import { Loader2, PlusCircle, Users, Lock, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createChatAction } from '@/app/chats/actions';
import { getClientsForCoach } from '@/app/coach/dashboard/actions';
import type { ClientProfile } from '@/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Combobox } from '@/components/ui/combobox';

interface CreateChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatCreated: () => void;
}

const chatFormSchema = z.object({
  name: z.string().min(3, 'Chat name must be at least 3 characters.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  type: z.enum(['open', 'private_group']),
  rules: z.string().optional(),
  participantIds: z.array(z.string()).optional(),
}).refine(data => {
    if (data.type === 'open' && (!data.rules || data.rules.length < 10)) {
        return false;
    }
    return true;
}, {
    message: "Rules are required for open chats and must be at least 10 characters.",
    path: ["rules"],
});

export function CreateChatDialog({ open, onOpenChange, onChatCreated }: CreateChatDialogProps) {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof chatFormSchema>>({
    resolver: zodResolver(chatFormSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'open',
      rules: '',
      participantIds: [],
    },
  });

   useEffect(() => {
    if (open) {
      setIsLoading(true);
      getClientsForCoach().then(result => {
        if (result.success && result.data) {
          setClients(result.data.filter(c => c.tier === 'premium' || c.tier === 'coaching'));
        }
        setIsLoading(false);
      });
    }
  }, [open]);

  const onSubmit = async (values: z.infer<typeof chatFormSchema>) => {
    setIsLoading(true);
    try {
        const result = await createChatAction(values);
        if (result.success) {
            toast({ title: 'Chat Created!', description: `${values.name} is now live.` });
            onChatCreated();
            onOpenChange(false);
            form.reset();
        } else {
            throw new Error(result.error || 'An unknown error occurred.');
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  const clientOptions = clients.map(c => ({
      value: c.uid,
      label: `${c.fullName} (${c.email})`
  }));
  
  const chatType = form.watch('type');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[90vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create a New Chat</DialogTitle>
          <DialogDescription>
            Build a new community space for your clients.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="px-6 py-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chat Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Mindful Eating Group" {...field} />
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
                          <Textarea placeholder="What is this chat about?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Chat Type</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col sm:flex-row gap-4"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="open" />
                              </FormControl>
                              <FormLabel className="font-normal flex items-center gap-2"><Users />Open to All Premium+</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="private_group" />
                              </FormControl>
                              <FormLabel className="font-normal flex items-center gap-2"><Lock />Private Group</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                {chatType === 'open' && (
                     <FormField
                        control={form.control}
                        name="rules"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Chat Rules</FormLabel>
                            <FormControl>
                                <Textarea placeholder="e.g., 1. Be supportive and respectful.&#10;2. No medical advice.&#10;3. Share wins and struggles." {...field} rows={4}/>
                            </FormControl>
                             <FormDescription>Users must agree to these rules before joining.</FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                )}
                
                {chatType === 'private_group' && (
                     <FormField
                        control={form.control}
                        name="participantIds"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Add Participants</FormLabel>
                             <Combobox
                                options={clientOptions}
                                placeholder="Select a client to add..."
                                searchPlaceholder='Search clients...'
                                value={''}
                                onChange={(value) => {
                                    if(value && !field.value?.includes(value)) {
                                        field.onChange([...(field.value || []), value]);
                                    }
                                }}
                            />
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                )}

                 {chatType === 'private_group' && form.getValues('participantIds') && form.getValues('participantIds')!.length > 0 && (
                     <div className="space-y-2">
                        <h4 className="text-sm font-medium">Selected Participants</h4>
                         <div className="flex flex-wrap gap-2">
                            {form.getValues('participantIds')?.map(id => {
                                const client = clients.find(c => c.uid === id);
                                return (
                                    <div key={id} className="flex items-center gap-2 text-sm bg-muted p-1 px-2 rounded-md">
                                        <span>{client?.fullName || id}</span>
                                         <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5"
                                            onClick={() => {
                                                const newIds = form.getValues('participantIds')?.filter(pId => pId !== id);
                                                form.setValue('participantIds', newIds);
                                            }}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )
                            })}
                         </div>
                     </div>
                 )}

                </form>
              </Form>
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-chat-form" disabled={isLoading} onClick={form.handleSubmit(onSubmit)}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
