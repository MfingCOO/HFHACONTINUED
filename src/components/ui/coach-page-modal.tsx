
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from './scroll-area';
import { X } from 'lucide-react';
import { BaseModal } from './base-modal';

interface CoachPageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export function CoachPageModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  footer,
}: CoachPageModalProps) {
  return (
    <BaseModal
        isOpen={open}
        onClose={onOpenChange}
        title={title}
        description={description}
        className={className}
        footer={footer}
    >
        {children}
    </BaseModal>
  );
}
