
'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Reminder, dismissReminderAction } from '@/services/reminders';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { DataEntryDialog } from '../dashboard/data-entry-dialog';
import { pillarsAndTools } from '@/lib/pillars';
import { useToast } from '@/hooks/use-toast';
import { createStripeCheckoutSession } from '@/app/client/settings/actions';
import { useAuth } from '../auth/auth-provider';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, X, Trophy } from 'lucide-react';

interface SmartReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminder: Reminder & { id: string };
}

export function SmartReminderModal({ isOpen, onClose, reminder }: SmartReminderModalProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isDataEntryOpen, setIsDataEntryOpen] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);

    if (!reminder) return null;

    const pillar = pillarsAndTools.find(p => p.id === reminder.pillarId);
    const Icon = pillar?.icon || Trophy;
    const isCustomPopup = reminder.type === 'custom-popup';

    const handleDismiss = async () => {
        if (user?.uid && reminder.id) {
            await dismissReminderAction(user.uid, reminder.id);
        }
        onClose();
    };

    const handleActionClick = () => {
        // First dismiss the reminder, then perform the action
        handleDismiss();
        setTimeout(() => setIsDataEntryOpen(true), 150);
    }
    
    const handleUpgrade = async () => {
        if (!user || !reminder.requiredTier) return;
        
        setIsRedirecting(true);
        try {
            const { url, error } = await createStripeCheckoutSession(user.uid, reminder.requiredTier, 'monthly');
            if (url) {
                window.location.href = url;
            } else {
                throw new Error(error || "Could not create a checkout session.");
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
            setIsRedirecting(false);
        }
    }

    const handleDataEntryDialogClose = (wasSaved: boolean) => {
        setIsDataEntryOpen(false);
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleDismiss}>
                <DialogContent className="w-[90vw] sm:max-w-md">
                     {isCustomPopup && reminder.data?.imageUrl && (
                        <div className="relative w-full h-40">
                             <Image src={reminder.data.imageUrl} alt={reminder.title} layout="fill" className="object-cover rounded-t-lg" unoptimized/>
                        </div>
                    )}
                    <DialogHeader className="text-center pt-4">
                         {!isCustomPopup && (
                             <div className={`mx-auto bg-primary/10 rounded-full h-16 w-16 flex items-center justify-center mb-4`}>
                                <Icon className={`h-8 w-8 text-primary`} />
                            </div>
                         )}
                        <DialogTitle className="text-2xl">{reminder.title}</DialogTitle>
                        <DialogDescription className="text-base px-4">
                            {reminder.message}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        {reminder.type !== 'custom-popup' && (
                             <Button onClick={handleDismiss} variant="outline" className="w-full">Dismiss</Button>
                        )}
                       
                        {reminder.type === 'log' && pillar && (
                            <Button onClick={handleActionClick} className="w-full">Log {pillar.label}</Button>
                        )}
                        {reminder.type === 'upgrade' && reminder.requiredTier && (
                             <Button onClick={handleUpgrade} disabled={isRedirecting} className="w-full">
                                {isRedirecting && <Loader2 className="h-4 w-4 animate-spin" />}
                                Upgrade to {reminder.requiredTier}
                            </Button>
                        )}
                         {reminder.type === 'custom-popup' && reminder.data?.ctaUrl && reminder.data?.ctaText && (
                            <Button asChild className="w-full">
                                <Link href={reminder.data.ctaUrl} target="_blank" onClick={handleDismiss}>
                                    {reminder.data.ctaText}
                                </Link>
                            </Button>
                         )}
                         {reminder.type === 'custom-popup' && !reminder.data?.ctaUrl && (
                             <Button onClick={handleDismiss} className="w-full">{reminder.data?.ctaText || 'Got it!'}</Button>
                         )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {isDataEntryOpen && pillar && (
                <DataEntryDialog 
                    open={isDataEntryOpen}
                    onOpenChange={handleDataEntryDialogClose}
                    pillar={pillar}
                />
            )}
        </>
    );
}
