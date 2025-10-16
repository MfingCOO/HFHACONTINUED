
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { deleteCalendarEvent } from '@/app/coach/calendar/actions';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Loader2, Trash2, Calendar, Clock, Info, Video, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface AppointmentDetailDialogProps {
  isOpen: boolean;
  onClose: (wasDeleted: boolean) => void;
  event: any | null;
}

export function AppointmentDetailDialog({ isOpen, onClose, event }: AppointmentDetailDialogProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!event?.id) return;
    setIsDeleting(true);
    try {
      const result = await deleteCalendarEvent(event.id);
      if (result.success) {
        toast({ title: 'Appointment Cancelled', description: 'The appointment has been removed from your calendar.' });
        onClose(true); // Pass true to signal a deletion occurred
      } else {
        throw new Error(result.error || 'Failed to cancel appointment.');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!event) {
    return null;
  }

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const hasNotes = event.description && event.description.trim().length > 0;
  const hasVideoLink = event.videoCallLink && event.videoCallLink.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose(false)}>
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>
            Details for your upcoming appointment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground"/>
                <div className="text-sm">
                    <p className="font-medium">Date</p>
                    <p className="text-muted-foreground">{format(startDate, 'PPPP')}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground"/>
                <div className="text-sm">
                    <p className="font-medium">Time</p>
                    <p className="text-muted-foreground">{`${format(startDate, 'p')} - ${format(endDate, 'p')}`}</p>
                </div>
            </div>
            {event.coachName && (
                 <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground"/>
                    <div className="text-sm">
                        <p className="font-medium">With Coach</p>
                        <p className="text-muted-foreground">{event.coachName}</p>
                    </div>
                </div>
            )}
            {hasNotes && (
                 <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 mt-1 text-muted-foreground"/>
                    <div className="text-sm">
                        <p className="font-medium">Notes from Coach</p>
                        <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
                    </div>
                </div>
            )}
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            {hasVideoLink ? (
                 <Button asChild className="w-full sm:w-auto">
                    <Link href={event.videoCallLink} target="_blank">
                        <Video className="mr-2 h-4 w-4" />
                        Join Appointment
                    </Link>
                </Button>
            ) : (
                <div /> // Placeholder to keep spacing consistent
            )}
           
            <div className="flex gap-2 w-full sm:w-auto">
                 <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="flex-1 sm:flex-auto">
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Cancel
                </Button>
                <DialogClose asChild>
                    <Button variant="outline" className="flex-1 sm:flex-auto">Close</Button>
                </DialogClose>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
