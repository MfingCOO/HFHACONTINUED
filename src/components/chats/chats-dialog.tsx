'use client';

import { BaseModal } from '@/components/ui/base-modal';
import { ClientChatList } from './client-chat-list';

interface ChatsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatsDialog({ isOpen, onClose }: ChatsDialogProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="My Chats"
      description="All your coaching and challenge conversations."
    >
      <div className="p-4 sm:p-6">
        <ClientChatList />
      </div>
    </BaseModal>
  );
}
