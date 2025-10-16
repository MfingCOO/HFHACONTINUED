'use client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
    DialogDescription
} from '@/components/ui/dialog';
import { ChatView } from '@/components/chats/chat-view';
import { useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { markChatAsRead } from '@/services/firestore';
import { useDashboardState } from '@/contexts/DashboardActionsContext';


interface EmbeddedChatDialogProps {
    chatId: string;
    chatName: string;
    isOpen: boolean;
    onClose: () => void;
}


export function EmbeddedChatDialog({ chatId, chatName, isOpen, onClose }: EmbeddedChatDialogProps) {
    const { user, isCoach } = useAuth();
    const { fetchChats } = useDashboardState();

    useEffect(() => {
        if (isOpen && user && !isCoach && chatId) {
            markChatAsRead(user.uid, chatId).then(() => {
                if (fetchChats) {
                    fetchChats();
                }
            });
        }
    }, [isOpen, user, isCoach, chatId, fetchChats]);
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[90vw] max-w-xl h-[80vh] flex flex-col p-0 gap-0">
                 <DialogHeader className="p-4 border-b text-center flex-shrink-0">
                    <DialogTitle>{chatName}</DialogTitle>
                    <DialogClose />
                </DialogHeader>

                <div className="flex-1 min-h-0">
                    {/* The ChatView component is now fully self-sufficient and handles its own scrolling.
                        No more refs, useEffects, or timeouts are needed here. */}
                    <ChatView 
                        chatId={chatId} 
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
