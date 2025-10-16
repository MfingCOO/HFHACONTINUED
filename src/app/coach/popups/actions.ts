
'use server';

import { db as adminDb, admin } from '@/lib/firebaseAdmin';
import { uploadImageAction } from '../actions';
import { z } from 'zod';
import { format } from 'date-fns';

const popupSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(3),
    title: z.string().min(3),
    message: z.string().min(10),
    imageUrl: z.string().optional(),
    ctaText: z.string().min(2),
    ctaUrl: z.string().url().optional().or(z.literal('')),
    scheduledAt: z.date(), // Changed to a single date field
    targetType: z.enum(['all', 'tier', 'user']),
    targetValue: z.string().optional(),
}).refine(data => {
    if (data.targetType === 'tier' || data.targetType === 'user') {
        return !!data.targetValue;
    }
    return true;
}, {
    message: "A target value is required for this target type.",
    path: ["targetValue"],
});

type PopupFormValues = z.infer<typeof popupSchema>;

export async function savePopupAction(data: PopupFormValues): Promise<{ success: boolean; error?: string }> {
    try {
        // The data coming from the client now has a pre-combined `scheduledAt` Date object.
        const validation = popupSchema.safeParse(data);
        if (!validation.success) {
            // A more detailed error can be logged or returned
            throw new Error('Invalid form data provided.');
        }

        const { id, ...restOfData } = validation.data;
        
        const popupToSave = {
            ...restOfData,
            scheduledAt: admin.firestore.Timestamp.fromDate(restOfData.scheduledAt),
            status: 'scheduled',
        };

        if (restOfData.imageUrl && restOfData.imageUrl.startsWith('data:image')) {
            const uploadResult = await uploadImageAction(restOfData.imageUrl, 'popup-images');
            if (uploadResult.success && uploadResult.url) {
                popupToSave.imageUrl = uploadResult.url;
            } else {
                throw new Error(uploadResult.error || 'Failed to upload thumbnail');
            }
        }
        
        if (id) {
            // Update existing document
            const docRef = adminDb.collection('popups').doc(id);
            await docRef.update({ ...popupToSave, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        } else {
            // Create new document
            await adminDb.collection('popups').add({ ...popupToSave, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        }


        return { success: true };
    } catch (error: any) {
        console.error("Error creating/updating pop-up:", error);
        return { success: false, error: error.message };
    }
}

export async function deletePopupAction(popupId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!popupId) {
            throw new Error("No popup ID provided for deletion.");
        }
        await adminDb.collection('popups').doc(popupId).delete();
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting popup:", error);
        return { success: false, error: error.message };
    }
}


function serializeTimestamps(docData: any) {
    if (!docData) return docData;
    const newObject: { [key: string]: any } = { ...docData };
    for (const key in newObject) {
      if (newObject[key] instanceof admin.firestore.Timestamp) {
        newObject[key] = newObject[key].toDate().toISOString();
      } else if (typeof newObject[key] === 'object' && newObject[key] !== null && !Array.isArray(newObject[key])) {
          newObject[key] = serializeTimestamps(newObject[key]);
      }
    }
    return newObject;
}

export type Popup = {
    id: string;
    name: string;
    title: string;
    message: string;
    imageUrl?: string;
    ctaText: string;
    ctaUrl?: string;
    scheduledAt: admin.firestore.Timestamp;
    createdAt: admin.firestore.Timestamp;
    targetType: 'all' | 'tier' | 'user';
    targetValue?: string;
    status: 'scheduled' | 'active' | 'ended';
};

export async function getPopupsForCoach(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
        const popupsSnapshot = await adminDb.collection('popups').orderBy('scheduledAt', 'desc').get();
        const popups = popupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const serializableData = popups.map(serializeTimestamps);
        return { success: true, data: serializableData };
    } catch (error: any) {
        console.error("Error fetching pop-ups:", error);
        return { success: false, error: error.message };
    }
}
