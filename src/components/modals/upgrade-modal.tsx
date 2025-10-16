
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
import { UserTier } from '@/types';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredTier: UserTier;
  featureName: string;
  reason: string;
}

export function UpgradeModal({ isOpen, onClose, requiredTier, featureName, reason }: UpgradeModalProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isRedirecting, setIsRedirecting] = useState(false);

    const handleUpgrade = async () => {
        if (!user || !requiredTier) return;
        
        setIsRedirecting(true);
        try {
            const { url, error } = await createStripeCheckoutSession(user.uid, requiredTier, 'monthly');
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

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[90vw] sm:max-w-md">
                <DialogHeader className="text-center pt-4">
                    <DialogTitle className="text-2xl">Upgrade to Unlock {featureName}</DialogTitle>
                    <DialogDescription className="text-base px-4">
                        {reason}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button onClick={onClose} variant="outline" className="w-full">Maybe Later</Button>
                    <Button onClick={handleUpgrade} disabled={isRedirecting} className="w-full">
                        {isRedirecting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Upgrade to {requiredTier}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
