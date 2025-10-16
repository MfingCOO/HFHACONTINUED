

'use client';

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button, buttonVariants } from "../ui/button";
import { Loader2, MessageSquare, PlusCircle, ArrowRight, MoreVertical, LogOut, CalendarPlus } from "lucide-react";
import type { Chat, Challenge, UserTier } from "@/services/firestore";
import Image from "next/image";
import { Badge } from "../ui/badge";
import { EmbeddedChatDialog } from "../coach/chats/embedded-chat-dialog";
import { ClientChallengeDetailModal } from "../challenges/client-challenge-detail-modal";
import { getChallengeDetailsForCoach, getChallengesForCoach } from "@/app/coach/actions";
import { useToast } from "@/hooks/use-toast";
import { joinChat as joinChatAction, leaveChatAction, markChatAsRead } from "@/services/firestore";
import { TIER_ACCESS } from "@/types";
import { UpgradeModal } from "../modals/upgrade-modal";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookingDialog } from "../client/booking/BookingDialog";
import { useDashboardActions, useDashboardState } from "@/contexts/DashboardActionsContext";
import { cn } from "@/lib/utils";


type SerializableChat = Omit<Chat, 'createdAt' | 'lastClientMessage' | 'lastCoachMessage' | 'lastAutomatedMessage'> & {
    createdAt?: string;
    lastClientMessage?: string;
    lastCoachMessage?: string;
    lastAutomatedMessage?: string;
    lastMessage?: string;
    lastMessageSenderId?: string;
};

type SerializableChallenge = Omit<Challenge, 'dates' | 'createdAt' | 'progress'> & {
    dates: { from: string, to: string };
    createdAt?: string;
    progress?: {
        [userId: string]: {
            [date: string]: {
                [task: string]: boolean
            }
        }
    };
};

export function ClientChatList() {
    const { user, userProfile, loading: authLoading } = useAuth();
    // This component now gets its data from context, which is updated in real-time.
    const { chats, fetchChats } = useDashboardState();
    const { toast } = useToast();
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [allChallenges, setAllChallenges] = useState<SerializableChallenge[]>([]);
    
    const [selectedChat, setSelectedChat] = useState<{ id: string; name: string } | null>(null);
    const [selectedChallengeForModal, setSelectedChallengeForModal] = useState<SerializableChallenge | null>(null);
    const [upgradeModal, setUpgradeModal] = useState<{ isOpen: boolean; requiredTier: UserTier } | null>(null);
    const [joinAlert, setJoinAlert] = useState<{ isOpen: boolean; chat: SerializableChat | null }>({ isOpen: false, chat: null });
    const [leaveAlert, setLeaveAlert] = useState<{ isOpen: boolean; chat: SerializableChat | null }>({ isOpen: false, chat: null });
    const [isJoining, setIsJoining] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    
    const allChats = chats || [];

    useEffect(() => {
        if (user) {
            getChallengesForCoach().then(res => {
                if (res.success && res.data) {
                    setAllChallenges(res.data as SerializableChallenge[]);
                }
            })
        }
    }, [user]);

    const { myChats, availableChats } = useMemo(() => {
        const myChats = allChats.filter((chat: Chat) => chat.participants.includes(user?.uid || ''));
        const availableChats = allChats.filter((chat: Chat) => !chat.participants.includes(user?.uid || '') && chat.type === 'open');
        return { myChats, availableChats };
    }, [allChats, user]);
    

    const handleJoinClick = (chat: SerializableChat) => {
        const requiredTier: UserTier = 'premium';
        const currentTierIndex = userProfile ? TIER_ACCESS.indexOf(userProfile.tier) : 0;
        const requiredTierIndex = TIER_ACCESS.indexOf(requiredTier);

        if (currentTierIndex < requiredTierIndex) {
            setUpgradeModal({ isOpen: true, requiredTier });
        } else {
            setJoinAlert({ isOpen: true, chat });
        }
    };
    
    const handleConfirmJoin = async () => {
        if (!joinAlert.chat || !user) return;
        
        setIsJoining(true);
        const result = await joinChatAction(joinAlert.chat.id, user.uid);
        
        if (result.success) {
            toast({ title: "Welcome!", description: `You have successfully joined the "${joinAlert.chat.name}" chat.` });
            fetchChats();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error || "Could not join chat." });
        }

        setIsJoining(false);
        setJoinAlert({ isOpen: false, chat: null });
    };

    const handleConfirmLeave = async () => {
        if (!leaveAlert.chat || !user) return;

        setIsLeaving(true);
        const result = await leaveChatAction(leaveAlert.chat.id, user.uid);

        if (result.success) {
            toast({ title: "Chat Left", description: `You have left "${leaveAlert.chat.name}".` });
            fetchChats();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error || "Could not leave chat." });
        }

        setIsLeaving(false);
        setLeaveAlert({ isOpen: false, chat: null });
    };

    if (authLoading) {
        return (
            <div className="flex h-full items-center justify-center p-24">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    // A single, universal component for list items.
    const ChatListItem = ({ chat, isUnread }: { chat: SerializableChat, isUnread: boolean }) => (
        <div 
            onClick={() => setSelectedChat({ id: chat.id, name: chat.name })}
            className="w-full text-left p-3 rounded-lg border bg-card hover:bg-muted transition-colors flex items-center gap-2 cursor-pointer"
        >
             {isUnread && <div className="h-2.5 w-2.5 rounded-full bg-blue-500 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
                <p className="font-semibold">{chat.name}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{chat.description}</p>
            </div>
            <div className="flex items-center">
                <Button 
                    variant="secondary"
                    size="sm"
                    className="h-8"
                    onClick={(e) => { e.stopPropagation(); setSelectedChat({ id: chat.id, name: chat.name }); }}
                >
                    {isLoadingDetails ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Open'}
                </Button>
                {chat.type !== 'coaching' && (
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 ml-1">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setLeaveAlert({ isOpen: true, chat }); }}>
                                <LogOut className="mr-2 h-4 w-4" /> Leave Chat
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    );

    return (
        <>
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">My Chats</h2>
                 {userProfile?.tier === 'coaching' && (
                    <Button onClick={() => setIsBookingOpen(true)} size="sm" variant="outline">
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        Book a Call
                    </Button>
                )}
            </div>
            {myChats.length > 0 ? (
                <div className="space-y-3">
                    {myChats.map(chat => {
                        const isUnread = chat.lastMessageSenderId !== user?.uid;
                        return (
                            <ChatListItem 
                                key={chat.id} 
                                chat={chat}
                                isUnread={isUnread}
                            />
                        )
                    })}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">Your conversations will appear here once you join a chat or get coaching.</p>
            )}

            {availableChats.length > 0 && (
                 <div className="space-y-4 pt-8">
                    <h2 className="text-2xl font-bold tracking-tight">Discover Open Chats</h2>
                     <div className="space-y-3">
                        {availableChats.map(chat => (
                             <div key={chat.id} className="w-full text-left p-3 rounded-lg border bg-card hover:bg-muted transition-colors flex flex-col items-start gap-2 disabled:opacity-50">
                                <div className="flex-1 min-w-0 w-full">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold">{chat.name}</p>
                                        {chat.type === 'challenge' && <Badge variant="secondary">Challenge</Badge>}
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">{chat.description}</p>
                                </div>
                                <div className="w-full pt-2 border-t border-white/10">
                                     <Button onClick={() => handleJoinClick(chat)} size="sm" className="w-full">
                                        Join Chat
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {selectedChat && (
            <EmbeddedChatDialog 
                isOpen={!!selectedChat}
                onClose={() => {
                  setSelectedChat(null);
                  fetchChats(); // Refetch when closing a chat to update read status
                }}
                chatId={selectedChat.id}
                chatName={selectedChat.name}
            />
        )}
        
        {upgradeModal && (
            <UpgradeModal
                isOpen={upgradeModal.isOpen}
                onClose={() => setUpgradeModal(null)}
                requiredTier={upgradeModal.requiredTier}
                featureName="Community Chats"
                reason="Connect with the community and get extra motivation!"
            />
        )}
        {joinAlert.chat && (
            <AlertDialog open={joinAlert.isOpen} onOpenChange={() => setJoinAlert({ isOpen: false, chat: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Join "{joinAlert.chat.name}"</AlertDialogTitle>
                        <AlertDialogDescription>Please review the chat rules before joining:</AlertDialogDescription>
                        <div className="text-sm text-muted-foreground pt-2 text-left max-h-40 overflow-y-auto">
                            <ul className="list-disc pl-5 space-y-1">
                                {(joinAlert.chat.rules || ['Be respectful and supportive.']).map((rule, i) => <li key={i}>{rule}</li>)}
                            </ul>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmJoin} disabled={isJoining}>
                            {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Agree & Join
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
         {leaveAlert.chat && (
            <AlertDialog open={leaveAlert.isOpen} onOpenChange={() => setLeaveAlert({ isOpen: false, chat: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave "{leaveAlert.chat.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>You will be removed from this chat and will no longer receive messages. Are you sure?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmLeave} disabled={isLeaving} className="bg-destructive hover:bg-destructive/90">
                            {isLeaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Leave Chat
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
        <BookingDialog
            isOpen={isBookingOpen}
            onClose={() => setIsBookingOpen(false)}
        />
        </>
    )
}
