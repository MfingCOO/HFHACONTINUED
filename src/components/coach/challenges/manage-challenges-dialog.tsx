'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback, useMemo } from "react";
import type { Challenge } from "@/services/firestore";
import { Loader2, Users, Trophy, Calendar, MessageSquare, PlusCircle, MoreVertical, Edit, Trash2 } from "lucide-react";
import Image from "next/image";
import { format, formatDistanceToNowStrict, isPast, isFuture } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CreateChallengeDialog } from "@/components/coach/challenges/create-challenge-dialog";
import { getChallengesForCoach, deleteChallengeAction } from "@/app/coach/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { EmbeddedChatDialog } from '@/components/coach/chats/embedded-chat-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ManageCustomHabitsDialog } from './manage-custom-habits-dialog';
import { CoachPageModal } from '@/components/ui/coach-page-modal';

type SerializableChallenge = Omit<Challenge, 'dates' | 'createdAt'> & {
    dates: { from: string, to: string };
    createdAt?: string;
    [key: string]: any; // Allow other properties
};


interface ManageChallengesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageChallengesDialog({ open, onOpenChange }: ManageChallengesDialogProps) {
    const { toast } = useToast();
    const [challenges, setChallenges] = useState<SerializableChallenge[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [createDialogState, setCreateDialogState] = useState<{ open: boolean, challenge: SerializableChallenge | null }>({ open: false, challenge: null });
    const [habitsDialogState, setHabitsDialogState] = useState(false);
    const [detailDialogState, setDetailDialogState] = useState<{ open: boolean, chatInfo: {id: string, name: string} | null }>({ open: false, chatInfo: null });
    const [deleteAlertState, setDeleteAlertState] = useState<{ open: boolean, challenge: SerializableChallenge | null }>({ open: false, challenge: null });
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchChallenges = useCallback(async () => {
        setIsLoading(true);
        const result = await getChallengesForCoach();
        if (result.success && result.data) {
            setChallenges(result.data as SerializableChallenge[]);
        } else {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: result.error?.message || 'Could not fetch challenges.'
            });
        }
        setIsLoading(false);
    }, [toast]);

    useEffect(() => {
      if(open) {
        fetchChallenges();
      }
    }, [open, fetchChallenges]);

    const { upcoming, active, past } = useMemo(() => {
        const upcoming: SerializableChallenge[] = [];
        const active: SerializableChallenge[] = [];
        const past: SerializableChallenge[] = [];
        const now = new Date();

        challenges.forEach(challenge => {
            const from = new Date(challenge.dates.from);
            const to = new Date(challenge.dates.to);
            if (isPast(to)) {
                past.push(challenge);
            } else if (isFuture(from)) {
                upcoming.push(challenge);
            } else {
                active.push(challenge);
            }
        });
        return { upcoming, active, past };
    }, [challenges]);


    const handleEditClick = (challenge: SerializableChallenge) => {
        const initialDataForForm = {
            ...challenge,
            startDate: new Date(challenge.dates.from), // Convert string to Date
            durationDays: formatDistanceToNowStrict(new Date(challenge.dates.to), { unit: 'day', addSuffix: false }).split(' ')[0],
        };
        setCreateDialogState({ open: true, challenge: initialDataForForm as any });
    }

    const handleDelete = async () => {
        if (!deleteAlertState.challenge) return;
        setIsDeleting(true);
        try {
            const result = await deleteChallengeAction(deleteAlertState.challenge.id);
            if (result.success) {
                toast({ title: "Success", description: "The challenge has been deleted." });
                fetchChallenges();
            } else {
                throw new Error(result.error || "Failed to delete challenge.");
            }
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setDeleteAlertState({ open: false, challenge: null });
        }
    }
    
    const ChallengeList = ({ list }: { list: SerializableChallenge[] }) => (
         <div className="space-y-2">
            {list.length > 0 ? (
                list.map(challenge => (
                     <div key={challenge.id} className="flex items-center gap-2 rounded-lg border p-1.5 bg-card text-card-foreground">
                        <div className="relative w-10 h-10 flex-shrink-0">
                             <Image
                                src={challenge.thumbnailUrl || 'https://placehold.co/100x100.png'}
                                alt={challenge.name}
                                fill
                                className="object-cover rounded-md"
                                unoptimized
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs truncate">{challenge.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                                {format(new Date(challenge.dates.from), 'MMM d')} - {format(new Date(challenge.dates.to), 'MMM d, yyyy')}
                            </p>
                             <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> {challenge.participantCount} / {challenge.maxParticipants}</p>
                        </div>
                         <div className="flex items-center gap-0">
                             <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setDetailDialogState({open: true, chatInfo: { id: challenge.id, name: challenge.name } })}>
                                <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEditClick(challenge)}>
                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setDeleteAlertState({ open: true, challenge })} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                ))
            ) : (
                <div className="text-center text-muted-foreground p-8 text-sm">
                    <p>No challenges in this category.</p>
                </div>
            )}
        </div>
    )

    return (
        <>
        <CoachPageModal
            open={open}
            onOpenChange={onOpenChange}
            title="Manage Challenges"
            description="Create, edit, and view community challenges."
            footer={
                 <div className="flex justify-between w-full">
                    <Button onClick={() => setHabitsDialogState(true)} size="sm" variant="outline">
                        Custom Habits
                    </Button>
                    <Button onClick={() => setCreateDialogState({ open: true, challenge: null })} size="sm" className="gap-1">
                        <PlusCircle className="h-4 w-4" /> New Challenge
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
                    <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                    <TabsTrigger value="past">Past</TabsTrigger>
                </TabsList>
                <div className="flex-1 min-h-0 mt-2">
                    <TabsContent value="active" className="h-full m-0"><ChallengeList list={active} /></TabsContent>
                    <TabsContent value="upcoming" className="h-full m-0"><ChallengeList list={upcoming} /></TabsContent>
                    <TabsContent value="past" className="h-full m-0"><ChallengeList list={past} /></TabsContent>
                </div>
                </Tabs>
            )}
        </CoachPageModal>

        <CreateChallengeDialog 
            key={createDialogState.challenge?.id || 'new'}
            open={createDialogState.open} 
            onOpenChange={(isOpen) => setCreateDialogState({ open: isOpen, challenge: null })} 
            onChallengeUpserted={fetchChallenges}
            initialData={createDialogState.challenge} 
        />
         {detailDialogState.chatInfo && (
            <EmbeddedChatDialog
                chatId={detailDialogState.chatInfo.id}
                chatName={detailDialogState.chatInfo.name}
                isOpen={detailDialogState.open}
                onClose={() => setDetailDialogState({ open: false, chatInfo: null })}
            />
        )}
        <ManageCustomHabitsDialog 
            open={habitsDialogState}
            onOpenChange={setHabitsDialogState}
        />
        <AlertDialog open={deleteAlertState.open} onOpenChange={() => setDeleteAlertState({ open: false, challenge: null })}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the challenge "{deleteAlertState.challenge?.name}". This action cannot be undone.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                     {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete Challenge
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
