'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Trash2, FileText, Download, Sparkles, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getLibraryDocumentsAction, uploadDocumentAction, deleteDocumentAction, LibraryDocument, updateDocumentTextAction } from '@/app/coach/library/actions';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as AlertDialogContentComponent,
  AlertDialogDescription as AlertDialogDescriptionComponent,
  AlertDialogFooter as AlertDialogFooterComponent,
  AlertDialogHeader as AlertDialogHeaderComponent,
  AlertDialogTitle as AlertDialogTitleComponent,
} from "@/components/ui/alert-dialog";
import { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/components/auth/auth-provider';
import Link from 'next/link';
import { AIPlaygroundDialog } from './ai-playground-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { User } from 'firebase/auth';
import { CoachPageModal } from '@/components/ui/coach-page-modal';


interface ManageLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function UploadDialog({ onUploadSuccess, user }: { onUploadSuccess: () => void; user: User | null }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };
    
    const handleUpload = async () => {
        if (!selectedFile || !user?.uid || !user?.displayName) {
             toast({ variant: 'destructive', title: 'Error', description: 'File and user information are required.' });
             return;
        };
        setIsUploading(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(selectedFile);
            reader.onload = async () => {
                const base64 = reader.result as string;
                const result = await uploadDocumentAction(base64, selectedFile.name, selectedFile.type, fileContent, user.uid, user.displayName!);
                if (result.success) {
                    toast({ title: 'Upload Successful', description: `"${selectedFile.name}" has been added.` });
                    onUploadSuccess();
                    setIsOpen(false);
                    setSelectedFile(null);
                    setFileContent('');
                } else {
                    throw new Error(result.error || 'Upload failed');
                }
            };
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Upload Error', description: error.message });
        } finally {
            setIsUploading(false);
        }
    }

    return (
        <>
        <Tooltip>
            <TooltipTrigger asChild>
                <Button onClick={() => setIsOpen(true)} disabled={isUploading} variant="outline" size="sm">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <p>Upload Document</p>
            </TooltipContent>
        </Tooltip>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload New Document</DialogTitle>
                    <DialogDescription>Select a file and provide its text content for the AI.</DialogDescription>
                </DialogHeader>
                 <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="file-upload">Step 1: Select File</Label>
                         <Input id="file-upload" type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.doc,.docx,.txt" />
                         {selectedFile && <p className="text-sm text-muted-foreground">Selected: {selectedFile.name}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="file-content">Step 2: Paste Content</Label>
                        <Textarea 
                            id="file-content"
                            placeholder="Paste the full text content of the document here..." 
                            rows={10}
                            value={fileContent}
                            onChange={(e) => setFileContent(e.target.value)}
                        />
                    </div>
                 </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleUpload} disabled={isUploading || !selectedFile || !fileContent}>
                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Upload
                    </Button>
                 </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    )
}

function EditContentDialog({ doc, onUpdateSuccess, open, onOpenChange }: { doc: LibraryDocument | null, onUpdateSuccess: () => void, open: boolean, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [content, setContent] = useState('');

    useEffect(() => {
        if (doc) {
            setContent(doc.text || '');
        }
    }, [doc]);
    
    if (!doc) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateDocumentTextAction(doc.id, content);
            if (result.success) {
                toast({ title: "Content Updated" });
                onUpdateSuccess();
                onOpenChange(false);
            } else {
                throw new Error(result.error || 'Failed to update content.');
            }
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Edit Content for "{doc.name}"</DialogTitle>
                </DialogHeader>
                <div className="flex-1 min-h-0">
                     <Textarea 
                        placeholder="Text content of the document..." 
                        className="h-full resize-none"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Content
                    </Button>
                 </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


export function ManageLibraryDialog({ open, onOpenChange }: ManageLibraryDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [documents, setDocuments] = useState<LibraryDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [deleteAlertState, setDeleteAlertState] = useState<{ open: boolean; doc: LibraryDocument | null }>({ open: false, doc: null });
    const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
    const [editDocState, setEditDocState] = useState<{ open: boolean, doc: LibraryDocument | null }>({open: false, doc: null});

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
        if(open) {
            fetchDocuments();
        }
    }, [open, fetchDocuments]);

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
    
    const getInitials = (name: string) => {
        if (!name) return '';
        const names = name.split(' ');
        if (names.length > 1) {
          return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return name.charAt(0).toUpperCase();
    }


    return (
        <>
            <TooltipProvider>
                <CoachPageModal
                    open={open}
                    onOpenChange={onOpenChange}
                    title="Document Library"
                    description="Upload and manage documents to power the AI's knowledge base."
                    footer={
                        <div className="flex justify-between w-full">
                            <Button variant="outline" size="sm" onClick={() => setIsPlaygroundOpen(true)}>
                                <Sparkles className="mr-2 h-4 w-4" /> AI Playground
                            </Button>
                             <UploadDialog onUploadSuccess={fetchDocuments} user={user} />
                        </div>
                    }
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    </div>
                    ) : (
                    <div className="space-y-1.5">
                        {documents.length > 0 ? documents.map(doc => {
                            const displayName = doc.name.length > 20 ? `${doc.name.substring(0, 17)}...` : doc.name;
                            const coachInitials = getInitials(doc.coachName);
                            return (
                        <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-2 pr-1">
                            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate" title={doc.name}>{displayName}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {coachInitials} - {format(new Date(doc.createdAt), 'MM/dd/yy')}
                                </p>
                            </div>
                                <div className="flex items-center gap-0 flex-shrink-0">
                                <Button variant="ghost" size="icon" asChild>
                                    <Link href={doc.url} target="_blank" download><Download className="h-4 w-4" /></Link>
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setEditDocState({ open: true, doc })}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
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
                            </div>
                        </div>
                        )}) : (
                        <div className="text-center text-muted-foreground py-16">
                            <p>No documents have been uploaded yet.</p>
                        </div>
                    )}
                    </div>
                    )}
                </CoachPageModal>
            </TooltipProvider>
            
            <AIPlaygroundDialog isOpen={isPlaygroundOpen} onClose={() => setIsPlaygroundOpen(false)} />
            
            <EditContentDialog 
                open={editDocState.open}
                onOpenChange={(isOpen) => setEditDocState({open: isOpen, doc: null})}
                doc={editDocState.doc}
                onUpdateSuccess={fetchDocuments}
            />

             <AlertDialog open={deleteAlertState.open} onOpenChange={(open) => !open && setDeleteAlertState({ open: false, doc: null })}>
                <AlertDialogContentComponent>
                    <AlertDialogHeaderComponent>
                        <AlertDialogTitleComponent>Are you absolutely sure?</AlertDialogTitleComponent>
                        <AlertDialogDescriptionComponent>
                            This action cannot be undone. This will permanently delete the document "{deleteAlertState.doc?.name}" from the AI's knowledge base.
                        </AlertDialogDescriptionComponent>
                    </AlertDialogHeaderComponent>
                    <AlertDialogFooterComponent>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={!!isDeleting}>
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooterComponent>
                </AlertDialogContentComponent>
            </AlertDialog>
        </>
    );
}
