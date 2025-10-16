'use client';

import {
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, Image as ImageIcon, Users, User, Award } from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { savePopupAction } from '@/app/coach/popups/actions';
import { TIER_ACCESS, ClientProfile } from '@/types';
import { getClientsForCoach } from '@/app/coach/dashboard/actions';
import { Combobox } from '@/components/ui/combobox';
import { BaseModal } from '@/components/ui/base-modal';


const popupSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(3, "Campaign name is required."),
    title: z.string().min(3, "Title is required."),
    message: z.string().min(10, "Message is required."),
    imageUrl: z.string().optional(),
    ctaText: z.string().min(2, "Button text is required."),
    ctaUrl: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
    // This will be sent to the server as a single Date object
    scheduledAt: z.date(),
    targetType: z.enum(['all', 'tier', 'user']),
    targetValue: z.string().optional(),
}).refine(data => {
    if (data.targetType === 'tier' || data.targetType === 'user') {
        return !!data.targetValue;
    }
    return true;
}, {
    message: "A target value is required for this target type.",
    path: ["targetValue"],
});


type PopupFormValues = z.infer<typeof popupSchema>;

interface CreatePopupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPopupSaved?: () => void;
  initialData?: PopupFormValues | any | null; // Allow flexible initial data
}

export function CreatePopupDialog({ open, onOpenChange, onPopupSaved, initialData }: CreatePopupDialogProps) {
    const { toast } = useToast();
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [clients, setClients] = useState<ClientProfile[]>([]);
    
    const isEditing = !!initialData;

    const form = useForm<PopupFormValues>({
        resolver: zodResolver(popupSchema),
        defaultValues: {
            id: undefined,
            name: '',
            title: '',
            message: '',
            imageUrl: '',
            ctaText: 'Learn More',
            ctaUrl: '',
            scheduledAt: new Date(),
            targetType: 'all',
            targetValue: '',
        },
    });

    useEffect(() => {
        if (open) {
            const fetchClients = async () => {
                const result = await getClientsForCoach();
                if (result.success && result.data) {
                    setClients(result.data as ClientProfile[]);
                }
            };
            fetchClients();

            const defaultValues = {
                id: initialData?.id || undefined,
                name: initialData?.name || '',
                title: initialData?.title || '',
                message: initialData?.message || '',
                imageUrl: initialData?.imageUrl || '',
                ctaText: initialData?.ctaText || 'Learn More',
                ctaUrl: initialData?.ctaUrl || '',
                scheduledAt: initialData?.scheduledAt ? new Date(initialData.scheduledAt) : new Date(),
                targetType: initialData?.targetType || 'all',
                targetValue: initialData?.targetValue || '',
            };
            form.reset(defaultValues);
            setImagePreview(initialData?.imageUrl || null);
        }
    }, [open, initialData, form]);

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
                form.setValue('imageUrl', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const onSubmit = async (data: PopupFormValues) => {
        try {
            const result = await savePopupAction(data);

            if(result.success) {
                toast({ title: 'Success!', description: `Pop-up campaign has been ${isEditing ? 'updated' : 'created'}.` });
                onPopupSaved?.();
                onOpenChange(false);
            } else {
                 throw new Error(result.error || "An unknown error occurred");
            }
        } catch (error: any) {
            console.error("Popup save failed:", error);
            toast({
                title: "Save Failed",
                description: error.message,
                variant: 'destructive',
            });
        }
    }
    
    const targetType = form.watch('targetType');
    
    const clientOptions = clients.map(client => ({
        value: client.uid,
        label: `${client.fullName} (${client.email})`
    }));

    return (
        <Form {...form}>
            <form id="popup-form" onSubmit={form.handleSubmit(onSubmit)}>
                <BaseModal
                    isOpen={open}
                    onClose={() => onOpenChange(false)}
                    title={isEditing ? 'Edit Pop-up Campaign' : 'Create New Pop-up Campaign'}
                    className="max-w-2xl"
                    footer={
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" form="popup-form" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditing ? 'Update Campaign' : 'Create & Schedule'}
                            </Button>
                        </DialogFooter>
                    }
                >
                    <div className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Campaign Name (Internal)</FormLabel><FormControl><Input placeholder="e.g., Summer Coaching Discount" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="e.g., Limited Time Offer!" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="message" render={({ field }) => (
                            <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea placeholder="Describe your promotion or announcement..." {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormItem>
                            <FormLabel>Image</FormLabel>
                            <FormControl>
                                <Input type="file" accept="image/*" onChange={handleImageUpload} className="file:text-primary file:font-semibold"/>
                            </FormControl>
                        </FormItem>
                        {imagePreview && (
                            <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                                <Image src={imagePreview} alt="Pop-up preview" fill className="object-cover" unoptimized />
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="ctaText" render={({ field }) => (
                                <FormItem><FormLabel>Button Text (CTA)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="ctaUrl" render={({ field }) => (
                                <FormItem><FormLabel>Button Link (URL)</FormLabel><FormControl><Input placeholder="https://example.com/offer" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        
                        <FormField control={form.control} name="scheduledAt" render={({ field }) => (
                            <FormItem className="space-y-2"><FormLabel>Schedule Time</FormLabel>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                 <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={(date) => {
                                                if (!date) return;
                                                const newDate = new Date(field.value);
                                                newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                                                field.onChange(newDate);
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormControl>
                                    <Input
                                        type="time"
                                        value={field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, 'HH:mm') : ''}
                                        onChange={e => {
                                            const [hours, minutes] = e.target.value.split(':').map(Number);
                                            const newDate = new Date(field.value);
                                            newDate.setHours(hours, minutes);
                                            field.onChange(newDate);
                                        }}
                                    />
                                </FormControl>
                            </div>
                            <FormMessage /></FormItem>
                        )}/>

                        <FormField
                            control={form.control}
                            name="targetType"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Audience</FormLabel>
                                <Select 
                                    onValueChange={(value) => {
                                    field.onChange(value);
                                    form.setValue('targetValue', ''); // Reset target value on type change
                                    }} 
                                    value={field.value}
                                >
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select an audience" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    <SelectItem value="all"><div className="flex items-center gap-2"><Users /> All Users</div></SelectItem>
                                    <SelectItem value="tier"><div className="flex items-center gap-2"><Award /> By Tier</div></SelectItem>
                                    <SelectItem value="user"><div className="flex items-center gap-2"><User /> Specific User</div></SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />

                            {targetType === 'tier' && (
                                <FormField
                                    control={form.control}
                                    name="targetValue"
                                    render={({ field }) => (
                                    <FormItem><FormLabel>Select Tier</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a tier" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {TIER_ACCESS.map(tier => <SelectItem key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</SelectItem>)}
                                            </SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                    )}
                                />
                            )}

                            {targetType === 'user' && (
                                <FormField
                                    control={form.control}
                                    name="targetValue"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Select Client</FormLabel>
                                            <Combobox
                                                options={clientOptions}
                                                value={field.value || ''}
                                                onChange={field.onChange}
                                                placeholder='Select client...'
                                                searchPlaceholder='Search by name or email...'
                                                modal={true}
                                            />
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                    </div>
                </BaseModal>
            </form>
        </Form>
    );
}
