'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Trash2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getLibraryDocumentsAction, uploadDocumentAction, deleteDocumentAction, LibraryDocument, updateDocumentTextAction } from './actions';
import { format } from 'date-fns';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/components/auth/auth-provider';
import { AIPlaygroundDialog } from '@/components/coach/library/ai-playground-dialog';

export default function LibraryPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [documents, setDocuments] = useState<LibraryDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [deleteAlertState, setDeleteAlertState] = useState<{ open: boolean; doc: LibraryDocument | null }>({ open: false, doc: null });
    const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchDocuments = useCallback(async () => {
        setIsLoading(true);
        const result = await getLibraryDocumentsAction();
        if (result.success && result.data) {
            setDocuments(result.data);
        } else {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not fetch library documents.',
            });
        }
        setIsLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        setIsUploading(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result as string;
                // Assuming you'll extract text from PDFs on the server or have a different flow
                const result = await uploadDocumentAction(base64, file.name, file.type, '', user.uid, user.displayName || 'Coach');
                if (result.success) {
                    toast({
                        title: 'Upload Successful',
                        description: `"${file.name}" has been added to the library.`,
                    });
                    fetchDocuments();
                } else {
                    throw new Error(result.error || 'Upload failed');
                }
            };
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Upload Error',
                description: error.message,
            });
        } finally {
            setIsUploading(false);
             if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDelete = async () => {
        if (!deleteAlertState.doc) return;
        
        setIsDeleting(deleteAlertState.doc.id);
        try {
            const result = await deleteDocumentAction(deleteAlertState.doc.id, deleteAlertState.doc.storagePath);
            if(result.success) {
                toast({ title: 'Document Deleted', description: `"${deleteAlertState.doc.name}" has been removed.`});
                fetchDocuments();
            } else {
                 throw new Error(result.error || 'Failed to delete document.');
            }
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Deletion Error',
                description: error.message,
            });
        } finally {
            setIsDeleting(null);
            setDeleteAlertState({ open: false, doc: null });
        }
    }


    return (
        <>
            <div className="space-y-8 h-full flex flex-col">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Document Library</h1>
                        <p className="text-muted-foreground">Upload and manage documents to power the AI's knowledge base.</p>
                    </div>
                     <div className="flex gap-2">
                        <Button onClick={() => setIsPlaygroundOpen(true)} variant="outline">AI Playground</Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                            {isUploading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <PlusCircle className="mr-2 h-4 w-4" />
                            )}
                            Upload Document
                        </Button>
                    </div>
                </div>

                <div className="flex-1 min-h-0">
                    <Card className="flex flex-col h-full">
                        <CardHeader>
                            <CardTitle>Uploaded Documents</CardTitle>
                            <CardDescription>This is the central knowledge base for the AI.</CardDescription>
                        </CardHeader>
                        {isLoading ? (
                            <CardContent className="flex-1 flex items-center justify-center">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            </CardContent>
                        ) : documents.length === 0 ? (
                            <CardContent className="flex-1 flex items-center justify-center">
                                <div className="text-center text-muted-foreground">
                                    No documents have been uploaded yet.
                                </div>
                            </CardContent>
                        ) : (
                        <div className="flex-1 min-h-0">
                            <ScrollArea className="h-full">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Date Added</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {documents.map(doc => (
                                            <TableRow key={doc.id}>
                                                <TableCell className="font-medium flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                    {doc.name}
                                                </TableCell>
                                                <TableCell>{doc.type}</TableCell>
                                                <TableCell>{format(new Date(doc.createdAt), 'PPP')}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => setDeleteAlertState({ open: true, doc })}
                                                        disabled={isDeleting === doc.id}
                                                    >
                                                        {isDeleting === doc.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin"/>
                                                        ): (
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        )}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                        )}
                    </Card>
                </div>
            </div>
             <AlertDialog open={deleteAlertState.open} onOpenChange={(open) => !open && setDeleteAlertState({ open: false, doc: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the document "{deleteAlertState.doc?.name}" from the AI's knowledge base.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={!!isDeleting}>
                        Delete
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AIPlaygroundDialog
                isOpen={isPlaygroundOpen}
                onClose={() => setIsPlaygroundOpen(false)}
            />
        </>
    );
}
