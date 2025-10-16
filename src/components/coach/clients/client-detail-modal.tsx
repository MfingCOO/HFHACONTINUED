
'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClientStatsDashboard } from './client-stats-dashboard';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ClientProfile } from '@/types';
import { getCoachingChatIdForClient, deleteClientAction, getClientByIdAction, generateClientInsightAction, calculateDailySummariesAction } from '@/app/coach/clients/actions';
import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
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
import { Loader2, Lightbulb, Sparkles, CheckCircle, BarChart, MessageSquare, Calendar, Pencil } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ClientCalendarView } from './ClientCalendarView';
import { CoachNotes } from './CoachNotes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GenerateInsightOutput } from '@/ai/flows/generate-insight-flow';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { EmbeddedChatDialog } from '../chats/embedded-chat-dialog';

interface ClientDetailModalProps {
  client: ClientProfile;
  isOpen: boolean;
  onClose: () => void;
}

const AiInsightSection = ({ client }: { client: ClientProfile }) => {
    const { toast } = useToast();
    const [insightPeriod, setInsightPeriod] = useState(7);
    const [isGenerating, setIsGenerating] = useState(false);
    const [insight, setInsight] = useState<GenerateInsightOutput | null>(null);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setInsight(null);
        try {
            const result = await generateClientInsightAction(client.uid, insightPeriod);
            if (result.success && result.data) {
                setInsight(result.data);
            } else {
                throw new Error(result.error || 'Failed to generate insight.');
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Insight Failed',
                description: error.message,
            });
        } finally {
            setIsGenerating(false);
        }
    };
    
    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
                <Select onValueChange={(v) => setInsightPeriod(parseInt(v))} defaultValue={String(insightPeriod)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="3">Last 3 Days</SelectItem>
                        <SelectItem value="7">Last 7 Days</SelectItem>
                        <SelectItem value="14">Last 14 Days</SelectItem>
                        <SelectItem value="30">Last 30 Days</SelectItem>
                    </SelectContent>
                </Select>
                <Button onClick={handleGenerate} disabled={isGenerating} className="w-full sm:w-auto">
                    {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate
                </Button>
            </div>

            {isGenerating && (
                <div className="flex items-center justify-center p-8 rounded-lg bg-muted">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
            
            {insight && (
                <div className="rounded-lg bg-background/80 p-4 space-y-3 animate-in fade-in-50">
                    <h3 className="text-lg font-bold text-primary flex items-center gap-2"><Sparkles className="h-5 w-5" /> {insight.title}</h3>
                    <div>
                        <h4 className="font-semibold text-sm">Pattern Identified:</h4>
                        <p className="text-sm text-muted-foreground">{insight.pattern}</p>
                    </div>
                        <div>
                        <h4 className="font-semibold text-sm">The "Why":</h4>
                        <p className="text-sm text-muted-foreground">{insight.explanation}</p>
                    </div>
                        <div className="bg-primary/10 border-l-4 border-primary text-primary-foreground p-3 rounded-r-lg">
                        <h4 className="font-semibold flex items-center gap-2 text-sm text-primary"><CheckCircle className="h-5 w-5" /> Suggestion:</h4>
                        <p className="text-foreground/90 text-sm">{insight.suggestion}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

export function ClientDetailModal({ client: initialClient, isOpen, onClose }: ClientDetailModalProps) {
  const { toast } = useToast();
  const [client, setClient] = useState<ClientProfile | null>(initialClient);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [deleteClientAlertOpen, setDeleteClientAlertOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chatInfo, setChatInfo] = useState<{ id: string; name: string } | null>(null);
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);

  
  const handleRefreshAndRefetch = useCallback(async () => {
    if (!initialClient.uid) return;
    setIsRefreshing(true);
    try {
        await calculateDailySummariesAction(initialClient.uid);
        const result = await getClientByIdAction(initialClient.uid);
        if (result.success && result.data) {
            setClient(result.data);
            toast({
                title: "Stats Refreshed",
                description: `${initialClient.fullName}'s summary is now up-to-date.`,
            });
        } else {
             throw new Error(result.error || "Could not refetch client data after refresh.");
        }
    } catch (error: any) {
         toast({
            variant: 'destructive',
            title: "Update Failed",
            description: error.message
        });
    } finally {
        setIsRefreshing(false);
    }
  }, [initialClient.uid, initialClient.fullName, toast]);

  useEffect(() => {
    if (isOpen && initialClient.uid) {
      setClient(initialClient);
      if(initialClient.tier === 'coaching') {
        getCoachingChatIdForClient(initialClient.uid).then(result => {
          if (result.success && result.chatId) {
            setChatInfo({ id: result.chatId, name: `${initialClient.fullName} Coaching` });
          }
        });
      }
    } else {
        setChatInfo(null);
    }
  }, [isOpen, initialClient]);


  const handleDeleteClient = async () => {
    if (!client?.uid) return;
    setIsDeletingClient(true);
    try {
        const result = await deleteClientAction(client.uid);
        if (result.success) {
            toast({ title: "Client Deleted", description: "The client and their data have been removed." });
            onClose(); 
        } else {
            throw new Error(result.error || "Could not delete the client.");
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Deletion Failed", description: error.message });
    } finally {
        setIsDeletingClient(false);
        setDeleteClientAlertOpen(false);
    }
  };


  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] h-[90dvh] max-w-4xl flex flex-col">
        <DialogHeader className="p-4 border-b">
          <DialogTitle srOnly>{client?.fullName || "Client"}'s Command Center</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
                {client && (
                    <Accordion type="single" collapsible defaultValue="item-1" className="w-full space-y-4">
                        <AccordionItem value="item-1" className="border rounded-lg overflow-hidden">
                            <AccordionTrigger className="p-4 hover:no-underline">
                                <div className="flex items-center gap-3 flex-1">
                                    <BarChart className="mr-2 h-5 w-5"/>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-base text-left">At-a-Glance Stats</h3>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 pt-0">
                                <ClientStatsDashboard 
                                    client={client}
                                    onDeleteClient={() => setDeleteClientAlertOpen(true)}
                                    onRefresh={handleRefreshAndRefetch}
                                    isRefreshing={isRefreshing}
                                />
                            </AccordionContent>
                        </AccordionItem>
                        
                         <div className="grid grid-cols-2 gap-4">
                             <Button onClick={() => setIsChatDialogOpen(true)} disabled={!chatInfo}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Open Chat
                            </Button>
                            <ClientCalendarView client={client} />
                        </div>

                        <AccordionItem value="item-2" className="border rounded-lg overflow-hidden">
                            <AccordionTrigger className="p-4 hover:no-underline"><Lightbulb className="mr-2 h-5 w-5"/> AI Client Insight</AccordionTrigger>
                            <AccordionContent className="p-4 pt-0">
                                <AiInsightSection client={client} />
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-5" className="border rounded-lg overflow-hidden">
                            <AccordionTrigger className="p-4 hover:no-underline"><Pencil className="mr-2 h-5 w-5"/> Coach Notes</AccordionTrigger>
                            <AccordionContent className="p-4 pt-0">
                                <CoachNotes client={client} />
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                )}
            </div>
          </ScrollArea>
        </div>
        
        <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>

         <AlertDialog open={deleteClientAlertOpen} onOpenChange={setDeleteClientAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete {client?.fullName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action is irreversible. It will permanently delete the client's account, all their data, and their access to the app.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteClient} disabled={isDeletingClient} className="bg-destructive hover:bg-destructive/90">
                         {isDeletingClient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete Client
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>

     {chatInfo && (
        <EmbeddedChatDialog 
            isOpen={isChatDialogOpen}
            onClose={() => setIsChatDialogOpen(false)}
            chatId={chatInfo.id}
            chatName={chatInfo.name}
        />
    )}
    </>
  );
}
