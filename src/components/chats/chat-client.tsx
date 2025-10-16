'use client';

import { ChatView } from '@/components/chats/chat-view';
import { useParams } from 'next/navigation';

export function ChatClient() {
    const params = useParams();
    const chatId = params.id as string;

    return <ChatView chatId={chatId} />;
}
