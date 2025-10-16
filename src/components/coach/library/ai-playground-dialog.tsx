
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { askLibrary, AskLibraryOutput } from '@/ai/flows/ask-library-flow';
import { BaseModal } from '@/components/ui/base-modal';
import { getClientsForCoach } from '@/app/coach/dashboard/actions';
import { ClientProfile } from '@/types';
import { Combobox } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AIPlaygroundDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIPlaygroundDialog({ isOpen, onClose }: AIPlaygroundDialogProps) {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [periodInDays, setPeriodInDays] = useState<number>(14);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskLibraryOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingClients, setIsFetchingClients] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsFetchingClients(true);
      getClientsForCoach().then(result => {
        if (result.success && result.data) {
          setClients(result.data as ClientProfile[]);
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch clients.' });
        }
        setIsFetchingClients(false);
      });
    }
  }, [isOpen, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !selectedClientId) return;

    setIsLoading(true);
    setAnswer(null);
    try {
      const result = await askLibrary({
        clientId: selectedClientId,
        periodInDays: periodInDays,
        question,
      });
      setAnswer(result);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to get an answer from the AI.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const clientOptions = clients.map(client => ({
      value: client.uid,
      label: client.fullName,
  }));

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Playground"
      description="See how the AI applies the library's principles to a specific client."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <Label>Client</Label>
                    {isFetchingClients ? <Loader2 className="mt-2 h-5 w-5 animate-spin" /> : (
                        <Combobox
                            options={clientOptions}
                            value={selectedClientId}
                            onChange={setSelectedClientId}
                            placeholder="Select a client..."
                            searchPlaceholder="Search clients..."
                        />
                    )}
                 </div>
                 <div>
                    <Label>Analysis Period</Label>
                     <Select onValueChange={(v) => setPeriodInDays(parseInt(v))} defaultValue={String(periodInDays)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="3">Last 3 Days</SelectItem>
                            <SelectItem value="7">Last 7 Days</SelectItem>
                            <SelectItem value="14">Last 14 Days</SelectItem>
                            <SelectItem value="30">Last 30 Days</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
            </div>
            <Textarea
                placeholder="Ask a question about the selected client, e.g., 'What is the biggest factor affecting this client's cravings?'"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || isFetchingClients || !selectedClientId || !question.trim()} className="w-full">
                {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                )}
                Ask AI
            </Button>
        </form>

        <div className="mt-4">
             {isLoading ? (
                 <div className="flex justify-center items-center h-24">
                     <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : answer ? (
                 <div className="p-4 rounded-lg bg-muted/50 border space-y-2 animate-in fade-in">
                     <h3 className="font-semibold flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" /> AI Response:</h3>
                    <ScrollArea className="h-40">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap pr-4">{answer.answer}</p>
                    </ScrollArea>
                </div>
            ) : (
                 <div className="text-center text-sm text-muted-foreground p-8">
                    Your AI's answer will appear here.
                </div>
            )}
        </div>
      </div>
    </BaseModal>
  );
}
