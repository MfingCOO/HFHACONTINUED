'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from './scroll-area';
import { X } from 'lucide-react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export function BaseModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  footer,
}: BaseModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn("w-[90vw] max-w-4xl h-[90dvh] flex flex-col p-0", className)}>
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className='flex-1 min-h-0'>
            <ScrollArea className="h-full">
                <div className="p-4">
                {children}
                </div>
            </ScrollArea>
        </div>
        
        {footer && (
            <div className="p-4 border-t flex-shrink-0">
                {footer}
            </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
