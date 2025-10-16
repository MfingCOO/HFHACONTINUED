
'use client';
import { CoachPageModal } from '@/components/ui/coach-page-modal';
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback, useMemo } from "react";
import type { Chat, ClientProfile } from "@/services/firestore";
import { Loader2, MessageSquare, MoreVertical, Trash2 } from "lucide-react";
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
import { EmbeddedChatDialog } from '@/components/coach/chats/embedded-chat-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { differenceInHours } from 'date-fns';
import { useAuth } from '@/components/auth/auth-provider';
import { createChatAction, deleteChatAction, getChatsAndClientsForCoach } from '@/app/chats/actions';
import { CreateChatDialog } from './create-chat-dialog';

type SerializableChat = Omit<Chat, 'createdAt' | 'lastClientMessage' | 'lastCoachMessage' | 'lastAutomatedMessage'> & {
    createdAt?: string;
    lastClientMessage?: string;
    lastCoachMessage?: string;
    lastAutomatedMessage?: string;
};

interface ManageChatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageChatsDialog({ open, onOpenChange }: ManageChatsDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [allChats, setAllChats] = useState<SerializableChat[]>([]);
    const [allClients, setAllClients] = useState<ClientProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // This state holds the sorted chats and prevents hydration errors.
    const [sortedChats, setSortedChats] = useState<{
        activeCoachingChats: SerializableChat[],
        miaCoachingChats: SerializableChat[],
        groupChats: SerializableChat[]
    }>({ activeCoachingChats: [], miaCoachingChats: [], groupChats: [] });

    // This controls the visibility of the lists to prevent hydration mismatch.
    const [isClientReady, setIsClientReady] = useState(false);

    const [detailDialogState, setDetailDialogState] = useState<{ open: boolean, chatInfo: {id: string, name: string} | null }>({ open: false, chatInfo: null });
    const [deleteAlertState, setDeleteAlertState] = useState<{ open: boolean, chat: SerializableChat | null }>({ open: false, chat: null });
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);

    const fetchChats = useCallback(async () => {
        setIsLoading(true);
        const result = await getChatsAndClientsForCoach();
        if (result.success && result.data) {
            setAllChats(result.data.chats as SerializableChat[]);
            setAllClients(result.data.clients as ClientProfile[]);
        } else {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: result.error?.message || 'Could not fetch chats.'
            });
        }
        setIsLoading(false);
    }, [toast]);

    useEffect(() => {
      if(open) {
        fetchChats();
      }
    }, [open, fetchChats]);

    // This effect runs only on the client, after initial render, to prevent hydration errors.
    useEffect(() => {
        if (isLoading) return;

        const coaching: SerializableChat[] = [];
        const group: SerializableChat[] = [];

        allChats.forEach(chat => {
            if (chat.type === 'coaching') {
                coaching.push(chat);
            } else {
                group.push(chat);
            }
        });

        const now = new Date();
        const miaThresholdHours = 48;
        
        const active: SerializableChat[] = [];
        const mia: SerializableChat[] = [];

        coaching.forEach(chat => {
            const lastClientMsg = chat.lastClientMessage ? new Date(chat.lastClientMessage).getTime() : 0;
            if (lastClientMsg > 0 && differenceInHours(now, lastClientMsg) < miaThresholdHours) {
                active.push(chat);
            } else {
                mia.push(chat);
            }
        });

        // Sort ACTIVE list: oldest un-answered client messages at the top.
        active.sort((a, b) => {
            const a_client = a.lastClientMessage ? new Date(a.lastClientMessage).getTime() : 0;
            const a_coach = a.lastCoachMessage ? new Date(a.lastCoachMessage).getTime() : 0;
            const b_client = b.lastClientMessage ? new Date(b.lastClientMessage).getTime() : 0;
            const b_coach = b.lastCoachMessage ? new Date(b.lastCoachMessage).getTime() : 0;
            
            // Prioritize chats where coach has never replied
            if (a_client > a_coach && b_client <= b_coach) return -1;
            if (a_client <= a_coach && b_client > b_coach) return 1;

            // If both need replies, oldest client message first
            if (a_client > a_coach && b_client > b_coach) return a_client - b_client;

            // If both are answered, most recent coach reply last
            return a_coach - b_coach;
        });
        
        // Sort MIA list: the one who is next in line for a nudge is at the top.
        mia.sort((a, b) => {
            const a_last_nudge = a.lastAutomatedMessage ? new Date(a.lastAutomatedMessage).getTime() : 0;
            const a_last_client = a.lastClientMessage ? new Date(a.lastClientMessage).getTime() : 0;
            const a_effective_time = Math.max(a_last_nudge, a_last_client);

            const b_last_nudge = b.lastAutomatedMessage ? new Date(b.lastAutomatedMessage).getTime() : 0;
            const b_last_client = b.lastClientMessage ? new Date(b.lastClientMessage).getTime() : 0;
            const b_effective_time = Math.max(b_last_nudge, b_last_client);

            return a_effective_time - b_effective_time; // Oldest effective time first
        });

        group.sort((a,b) => {
            const dateA = new Date(a.lastMessage || a.createdAt || 0).getTime();
            const dateB = new Date(b.lastMessage || b.createdAt || 0).getTime();
            return dateB - dateA;
        });

        setSortedChats({ activeCoachingChats: active, miaCoachingChats: mia, groupChats: group });
        setIsClientReady(true); // Mark that client-side logic is complete.

    }, [allChats, allClients, isLoading]);


    const handleDelete = async () => {
        if (!deleteAlertState.chat || !user) return;
        setIsDeleting(true);
        try {
            const result = await deleteChatAction(deleteAlertState.chat.id, user.uid);
            if (result.success) {
                toast({ title: "Success", description: "The chat has been deleted." });
                fetchChats();
            } else {
                throw new Error(result.error || "Failed to delete chat.");
            }
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setDeleteAlertState({ open: false, chat: null });
        }
    }
    
    const ChatList = ({ list }: { list: SerializableChat[] }) => {
        if (list.length === 0) {
            return <p className="text-center text-muted-foreground p-8 text-sm">No chats in this category.</p>
        }
        
        const clientMap = new Map(allClients.map(c => [c.uid, c]));

        return (
             <div className="space-y-2">
                {list.map(chat => {
                    const clientUid = chat.type === 'coaching' ? chat.participants.find(p => !p.startsWith('coach-') && p !== user?.uid) : undefined;
                    const client = clientUid ? clientMap.get(clientUid) : null;
                    const clientName = client?.fullName || chat.name;
                    
                     return (
                         <div key={chat.id} className="flex items-center gap-2 rounded-lg border p-1.5 bg-card text-card-foreground">
                            <Avatar className="h-8 w-8 border">
                                <AvatarImage src={client?.photoURL || ''} alt={clientName || 'Chat'} />
                                <AvatarFallback>{clientName?.charAt(0) || 'C'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-xs truncate">{clientName}</p>
                                {chat.type !== 'coaching' && (
                                     <p className="text-[10px] text-muted-foreground truncate">{chat.participantCount} members</p>
                                )}
                            </div>
                             <div className="flex items-center gap-0">
                                 <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setDetailDialogState({open: true, chatInfo: { id: chat.id, name: clientName || chat.name } })}>
                                    <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setDeleteAlertState({ open: true, chat })} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <>
        <CoachPageModal
            open={open}
            onOpenChange={onOpenChange}
            title="Manage Chats"
            description="Review and manage all client and group conversations."
            footer={
                 <div className="flex justify-end w-full">
                    <Button onClick={() => setIsCreateChatOpen(true)} size="sm">
                        Create New Chat
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
                        <TabsTrigger value="active">Active ({sortedChats.activeCoachingChats.length})</TabsTrigger>
                        <TabsTrigger value="mia">MIA ({sortedChats.miaCoachingChats.length})</TabsTrigger>
                        <TabsTrigger value="group">Group ({sortedChats.groupChats.length})</TabsTrigger>
                    </TabsList>
                    <div className="flex-1 min-h-0 mt-2">
                        {/* Only render lists when client-side sorting is complete */}
                        {!isClientReady ? (
                             <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                        ) : (
                            <>
                                <TabsContent value="active" className="h-full m-0"><ChatList list={sortedChats.activeCoachingChats} /></TabsContent>
                                <TabsContent value="mia" className="h-full m-0"><ChatList list={sortedChats.miaCoachingChats} /></TabsContent>
                                <TabsContent value="group" className="h-full m-0"><ChatList list={sortedChats.groupChats} /></TabsContent>
                            </>
                        )}
                    </div>
                </Tabs>
            )}
        </CoachPageModal>

        <CreateChatDialog
            open={isCreateChatOpen}
            onOpenChange={setIsCreateChatOpen}
            onChatCreated={fetchChats}
        />

         {detailDialogState.chatInfo && (
            <EmbeddedChatDialog
                chatId={detailDialogState.chatInfo.id}
                chatName={detailDialogState.chatInfo.name}
                isOpen={detailDialogState.open}
                onClose={() => setDetailDialogState({ open: false, chatInfo: null })}
            />
        )}
        <AlertDialog open={deleteAlertState.open} onOpenChange={() => setDeleteAlertState({ open: false, chat: null })}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the chat "{deleteAlertState.chat?.name}". This action cannot be undone.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                     {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete Chat
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
