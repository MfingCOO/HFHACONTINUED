

'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lightbulb, Sparkles, CheckCircle, Salad, CloudSun } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface Insight {
  title: string;
  message: string;
  suggestion: string;
  logType?: 'craving' | 'binge';
}

interface InsightResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  insight: Insight | null;
}

export function InsightResponseModal({ isOpen, onClose, insight }: InsightResponseModalProps) {
  if (!insight) return null;

  // For now, these buttons just close the modal.
  // In a future step, they could open the relevant data entry dialog.
  const handleActionClick = () => {
      onClose();
  }

  const renderFooter = () => {
    if (insight.logType === 'craving') {
        return (
            <>
                <Button onClick={onClose} variant="outline" className="flex-1">Dismiss</Button>
                <Button onClick={handleActionClick} className="flex-1 bg-green-500 hover:bg-green-600 text-white">
                    <CloudSun className="mr-2 h-4 w-4" /> Add Relief Action
                </Button>
            </>
        )
    }
    if (insight.logType === 'binge') {
         return (
            <>
                <Button onClick={onClose} variant="outline" className="flex-1">Dismiss</Button>
                <Button onClick={handleActionClick} className="flex-1 bg-green-500 hover:bg-green-600 text-white">
                   <Salad className="mr-2 h-4 w-4" /> Plan Recovery
                </Button>
            </>
        )
    }
    return <Button onClick={onClose} className="w-full">Got it, thanks!</Button>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-lg h-auto max-h-[85vh] flex flex-col p-0 bg-gradient-to-br from-amber-50/95 to-green-50/95 text-foreground">
        <DialogHeader className="p-6 pb-2 text-center">
          <DialogTitle className="flex items-center justify-center gap-2 text-xl font-bold">
            <Lightbulb className="text-yellow-500 h-6 w-6" />
            {insight.title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
                <div className="px-6 space-y-4">
                    <div className="rounded-lg bg-background/50 p-4 space-y-3 animate-in fade-in-50">
                        <div>
                            <h4 className="font-semibold flex items-center gap-2 text-sm text-yellow-400"><Sparkles className="h-4 w-4" /> The "Why"</h4>
                            <p className="text-sm text-muted-foreground">{insight.message}</p>
                        </div>
                        <div className="bg-green-500/10 border-l-4 border-green-500 text-foreground p-3 rounded-r-lg">
                            <h4 className="font-semibold flex items-center gap-2 text-sm text-green-400"><CheckCircle className="h-5 w-5" /> Next Step</h4>
                            <p className="text-foreground/90 text-sm">{insight.suggestion}</p>
                        </div>
                         <p className="text-center text-xs italic text-muted-foreground pt-2">This log is a win—congratulations on growing stronger!</p>
                    </div>
                </div>
            </ScrollArea>
        </div>
        <DialogFooter className="p-4 border-t mt-auto flex-row gap-2">
          {renderFooter()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
