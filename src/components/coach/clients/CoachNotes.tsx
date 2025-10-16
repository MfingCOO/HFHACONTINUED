
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { addCoachNoteAction, getCoachNotesAction } from '@/app/coach/clients/actions';
import { ClientProfile, CoachNote } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface CoachNotesProps {
    client: ClientProfile;
}

export function CoachNotes({ client }: CoachNotesProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [notes, setNotes] = useState<CoachNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const noteTextRef = useRef<HTMLTextAreaElement>(null);

    const fetchNotes = useCallback(async () => {
        setIsLoading(true);
        const result = await getCoachNotesAction(client.uid);
        if (result.success && result.data) {
            setNotes(result.data);
        } else {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not fetch coach notes.'
            });
        }
        setIsLoading(false);
    }, [client.uid, toast]);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    const handleSaveNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!noteTextRef.current?.value.trim() || !user || !user.displayName) return;

        setIsSaving(true);
        const noteText = noteTextRef.current.value;

        try {
            const result = await addCoachNoteAction(client.uid, noteText, user.uid, user.displayName);
            if (result.success) {
                toast({ title: 'Note Saved' });
                if (noteTextRef.current) noteTextRef.current.value = '';
                fetchNotes(); // Refresh the notes list
            } else {
                throw new Error(result.error || 'Failed to save note.');
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Coach's Private Notes</CardTitle>
                <CardDescription>Leave private notes for yourself and other coaches regarding this client.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-48 w-full rounded-md border p-4">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : notes.length > 0 ? (
                        <div className="space-y-4">
                            {notes.map(note => (
                                <div key={note.id} className="flex items-start gap-3">
                                    <Avatar className="h-8 w-8 border">
                                        <AvatarImage src={`https://placehold.co/100x100.png`} alt={note.coachName} data-ai-hint="person avatar"/>
                                        <AvatarFallback>{note.coachName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-sm">{note.coachName}</p>
                                            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</p>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{note.note}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex justify-center items-center h-full">
                            <p className="text-sm text-muted-foreground">No notes for this client yet.</p>
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
            <CardFooter>
                 <form onSubmit={handleSaveNote} className="flex w-full items-start space-x-2">
                    <Textarea
                        ref={noteTextRef}
                        placeholder="Type your note here..."
                        rows={2}
                        disabled={isSaving}
                    />
                    <Button type="submit" size="icon" disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );
}
