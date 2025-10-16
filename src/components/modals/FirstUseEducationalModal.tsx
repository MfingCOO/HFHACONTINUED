
'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { EducationalContent } from '@/lib/educational-content';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Lock, X } from 'lucide-react';

interface FirstUseEducationalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  content: EducationalContent | null;
  isLocked: boolean;
}

export function FirstUseEducationalModal({
  isOpen,
  onClose,
  onConfirm,
  content,
  isLocked,
}: FirstUseEducationalModalProps) {
  if (!content) return null;

  const Icon = content.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-lg p-0 flex flex-col max-h-[85vh]">
        {/* Screen-reader only header for accessibility */}
        <DialogHeader className="sr-only">
          <DialogTitle>{content.title}</DialogTitle>
          <DialogDescription>{content.what}</DialogDescription>
        </DialogHeader>

        <div className="flex-shrink-0 p-6 space-y-4">
            <div className="text-center">
            <div className="mx-auto bg-primary/10 rounded-full h-16 w-16 flex items-center justify-center mb-2">
                <Icon className="h-8 w-8 text-primary" />
            </div>
            {isLocked && (
                <div className="flex justify-center">
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-amber-500/30 w-fit">
                    <Lock className="h-3 w-3 mr-1" />
                    {content.requiredTier.charAt(0).toUpperCase() + content.requiredTier.slice(1)} Plan Required
                </Badge>
                </div>
            )}
            </div>
        </div>

        <div className="flex-1 min-h-0 px-6">
            <ScrollArea className="h-full">
                <div className="space-y-3">
                    <div className="space-y-1">
                    <h3 className="font-semibold text-primary">What is it?</h3>
                    <p className="text-xs text-muted-foreground">{content.what}</p>
                    </div>
                    <div className="space-y-1">
                    <h3 className="font-semibold text-primary">How do I use it?</h3>
                    <p className="text-xs text-muted-foreground">{content.how}</p>
                    </div>
                    <div className="space-y-1">
                    <h3 className="font-semibold text-primary">Why does it work?</h3>
                    <p className="text-xs text-muted-foreground">{content.why}</p>
                    </div>
                </div>
            </ScrollArea>
        </div>
        
        <div className="p-6 pt-2 mt-auto flex flex-row gap-2 flex-shrink-0">
            <Button onClick={onClose} variant="outline" className="flex-1">Close</Button>
            <Button onClick={onConfirm} className="flex-1">
            {isLocked ? `Upgrade to ${content.requiredTier.charAt(0).toUpperCase() + content.requiredTier.slice(1)}` : 'Get Started'}
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
