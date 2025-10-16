'use client';
import { CoachPageModal } from '@/components/ui/coach-page-modal';
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback, useMemo } from "react";
import type { Popup, ClientProfile } from "@/types";
import { Loader2, PlusCircle, MoreVertical, Edit, Trash2, Users, Award, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { CreatePopupDialog } from '@/components/coach/popups/create-popup-dialog';
import { getPopupsForCoach, deletePopupAction } from "@/app/coach/popups/actions";
import { useAuth } from '@/components/auth/auth-provider';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';


type SerializablePopup = Omit<Popup, 'scheduledAt' | 'createdAt'> & {
    scheduledAt: string;
    createdAt: string;
};

interface ManagePopupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export function ManagePopupsDialog({ open, onOpenChange }: ManagePopupsDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [dialogState, setDialogState] = useState<{ open: boolean, popup: SerializablePopup | null }>({ open: false, popup: null });
    const [popups, setPopups] = useState<SerializablePopup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteAlertState, setDeleteAlertState] = useState<{ open: boolean, popupId: string | null, popupName?: string }>({ open: false, popupId: null });

    const fetchPopups = useCallback(async () => {
        setIsLoading(true);
        const result = await getPopupsForCoach();
        if (result.success && result.data) {
            setPopups(result.data as SerializablePopup[]);
        } else {
            toast({
                title: 'Error',
                description: result.error || 'Could not fetch pop-up campaigns.',
                variant: 'destructive',
            });
        }
        setIsLoading(false);
    }, [toast]);

    useEffect(() => {
        if(open) {
            fetchPopups();
        }
    }, [open, fetchPopups]);
    
     const { active, scheduled, past } = useMemo(() => {
        const active: SerializablePopup[] = [];
        const scheduled: SerializablePopup[] = [];
        const past: SerializablePopup[] = [];
        const now = new Date();

        popups.forEach(popup => {
            const scheduledAt = new Date(popup.scheduledAt);
            const oneDayAfter = new Date(scheduledAt.getTime() + 24 * 60 * 60 * 1000);

            if (now > oneDayAfter) {
                past.push(popup);
            } else if (scheduledAt > now) {
                scheduled.push(popup);
            } else {
                active.push(popup);
            }
        });
        return { active, scheduled, past };
    }, [popups]);

    const handleDelete = async () => {
        if (!deleteAlertState.popupId) return;

        setIsDeleting(true);
        try {
            const result = await deletePopupAction(deleteAlertState.popupId);
            if (result.success) {
                toast({ title: "Success", description: "Pop-up campaign has been deleted." });
                fetchPopups();
            } else {
                throw new Error(result.error || "Failed to delete campaign.");
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setDeleteAlertState({ open: false, popupId: null });
        }
    };
    
    const targetInfo: Record<string, { icon: React.ElementType, label: string }> = {
        all: { icon: Users, label: 'All Users' },
        tier: { icon: Award, label: 'By Tier' },
        user: { icon: UserIcon, label: 'Specific User' }
    };

    const PopupList = ({ list }: { list: SerializablePopup[] }) => {
        if (list.length === 0) {
            return <div className="text-center text-muted-foreground p-8 text-sm"><p>No campaigns in this category.</p></div>
        }
        
        return (
            <div className="space-y-2">
                {list.map(popup => {
                    const TargetIcon = targetInfo[popup.targetType]?.icon || Users;
                    
                    return (
                         <div key={popup.id} className="flex flex-col gap-2 rounded-lg border p-2 bg-card text-card-foreground">
                             <div className="flex items-start gap-2">
                                {popup.imageUrl && (
                                    <div className="relative w-12 h-12 flex-shrink-0">
                                        <Image src={popup.imageUrl} alt={popup.title} fill className="object-cover rounded-md" unoptimized/>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-xs truncate">{popup.title}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-1">{popup.message}</p>
                                </div>
                                <div className="flex items-center gap-0 self-start">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialogState({ open: true, popup })}>
                                        <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => setDeleteAlertState({ open: true, popupId: popup.id, popupName: popup.name })} className="text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                             <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-white/10 pt-1.5">
                                 <div className="flex items-center gap-1">
                                    <TargetIcon className="w-3 h-3"/> 
                                    <span className="capitalize">{popup.targetType}{popup.targetValue && `: ${popup.targetValue}`}</span>
                                </div>
                                <span>{format(new Date(popup.scheduledAt), 'MMM d, h:mm a')}</span>
                             </div>
                        </div>
                    )
                })}
            </div>
        )
    };
    
    return (
        <>
            <CoachPageModal
                open={open}
                onOpenChange={onOpenChange}
                title="Manage Pop-ups"
                description="Create and schedule targeted pop-up announcements for your users."
                footer={
                    <div className="flex justify-end w-full">
                        <Button onClick={() => setDialogState({ open: true, popup: null })} size="sm" className="gap-2">
                            <PlusCircle /> New Pop-up
                        </Button>
                    </div>
                }
            >
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    </div>
                ) : (
                    <Tabs defaultValue="active" className="w-full h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="active">Active</TabsTrigger>
                            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                            <TabsTrigger value="past">Past</TabsTrigger>
                        </TabsList>
                        <div className="flex-1 min-h-0 mt-2">
                             <TabsContent value="active" className="h-full m-0"><PopupList list={active} /></TabsContent>
                             <TabsContent value="scheduled" className="h-full m-0"><PopupList list={scheduled} /></TabsContent>
                             <TabsContent value="past" className="h-full m-0"><PopupList list={past} /></TabsContent>
                        </div>
                    </Tabs>
                )}
            </CoachPageModal>
            <CreatePopupDialog 
                key={dialogState.popup?.id || 'new'}
                open={dialogState.open} 
                onOpenChange={(isOpen) => setDialogState({ open: isOpen, popup: null })}
                onPopupSaved={fetchPopups}
                initialData={dialogState.popup}
            />
             <AlertDialog open={deleteAlertState.open} onOpenChange={() => setDeleteAlertState({ open: false, popupId: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the "{deleteAlertState.popupName || 'this'}" campaign. This action cannot be undone.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete Campaign
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
