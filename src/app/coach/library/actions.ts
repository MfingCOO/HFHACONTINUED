
'use server';

import { db as adminDb, admin } from '@/lib/firebaseAdmin';

export interface LibraryDocument {
    id: string;
    name: string;
    url: string;
    type: string;
    storagePath: string;
    text?: string;
    createdAt: string;
    coachId: string;
    coachName: string;
}

/**
 * Uploads a document to a specified path in Firebase Storage.
 */
async function uploadFileAction(base64DataUrl: string, fileName: string, fileType: string, path: string): Promise<{ success: boolean, url?: string, storagePath?: string, error?: string }> {
    if (!base64DataUrl.startsWith('data:')) {
        return { success: false, error: 'Invalid data URL.' };
    }

    try {
        const bucket = admin.storage().bucket('gs://hunger-free-and-happy-app.firebasestorage.app');
        const uniqueFileName = `${path}/${Date.now()}-${fileName}`;
        const file = bucket.file(uniqueFileName);

        const mimeType = base64DataUrl.substring(base64DataUrl.indexOf(':') + 1, base64DataUrl.indexOf(';'));
        const base64String = base64DataUrl.split(',')[1];
        const buffer = Buffer.from(base64String, 'base64');

        await file.save(buffer, {
            metadata: { contentType: mimeType },
            public: true,
            validation: 'md5'
        });

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;

        return { success: true, url: publicUrl, storagePath: uniqueFileName };

    } catch (error: any) {
        console.error("Error uploading file via server action: ", error);
        return { success: false, error: error.message || 'Failed to upload file.' };
    }
}


export async function uploadDocumentAction(base64: string, name: string, type: string, text: string = '', coachId: string, coachName: string): Promise<{ success: boolean; error?: string }> {
    try {
        const uploadResult = await uploadFileAction(base64, name, type, 'library');
        if (uploadResult.success && uploadResult.url && uploadResult.storagePath) {
            const docData = {
                name,
                type,
                text,
                url: uploadResult.url,
                storagePath: uploadResult.storagePath,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                coachId,
                coachName
            };
            await adminDb.collection('library').add(docData);
            return { success: true };
        } else {
            throw new Error(uploadResult.error || 'Failed to upload document to storage.');
        }
    } catch (error: any) {
        console.error("Error in uploadDocumentAction: ", error);
        return { success: false, error: error.message };
    }
}


export async function getLibraryDocumentsAction(): Promise<{ success: boolean; data?: LibraryDocument[]; error?: string }> {
    try {
        const snapshot = await adminDb.collection('library').orderBy('createdAt', 'desc').get();
        const documents = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                url: data.url,
                type: data.type,
                storagePath: data.storagePath,
                createdAt: (data.createdAt as admin.firestore.Timestamp).toDate().toISOString(),
                coachId: data.coachId,
                coachName: data.coachName,
                text: data.text,
            };
        });
        return { success: true, data: documents };
    } catch (error: any) {
        console.error("Error fetching library documents:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteDocumentAction(docId: string, storagePath: string): Promise<{ success: boolean; error?: string }> {
     try {
        if (!docId || !storagePath) {
            throw new Error("Document ID and Storage Path are required for deletion.");
        }

        const bucket = admin.storage().bucket('gs://hunger-free-and-happy-app.firebasestorage.app');
        const file = bucket.file(storagePath);
        
        await file.delete();
        await adminDb.collection('library').doc(docId).delete();
        
        return { success: true };

    } catch (error: any) {
        console.error("Error deleting document:", error);
        return { success: false, error: error.message };
    }
}

export async function updateDocumentTextAction(docId: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!docId) {
            throw new Error("Document ID is required.");
        }
        await adminDb.collection('library').doc(docId).update({ text });
        return { success: true };
    } catch (error: any) {
        console.error("Error updating document text:", error);
        return { success: false, error: error.message };
    }
}
