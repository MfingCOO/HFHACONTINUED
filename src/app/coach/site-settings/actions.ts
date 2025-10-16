
'use server';

import { db as adminDb, admin } from '@/lib/firebaseAdmin';
import type { SiteSettings } from '@/types';
import { z } from 'zod';


/**
 * Fetches the global site settings.
 */
export async function getSiteSettingsAction(): Promise<{ success: boolean; data?: SiteSettings; error?: string }> {
    try {
        const docRef = adminDb.collection('siteSettings').doc('v1');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const settingsData = docSnap.data() as SiteSettings;
            // Serialize Timestamps to ISO strings before returning to the client if they exist
            if (settingsData.availability?.vacationBlocks) {
                settingsData.availability.vacationBlocks = settingsData.availability.vacationBlocks.map(block => ({
                    ...block,
                    start: (block.start as unknown as admin.firestore.Timestamp).toDate().toISOString(),
                    end: (block.end as unknown as admin.firestore.Timestamp).toDate().toISOString(),
                }));
            }
            return { success: true, data: settingsData };
        } else {
            // Return default/empty state if not configured yet
            return { success: true, data: { url: '', videoCallLink: '' } };
        }
    } catch (error: any) {
        console.error("Error fetching site settings: ", error);
        return { success: false, error: error.message };
    }
}

const siteSettingsSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL." }).or(z.literal('')),
  videoCallLink: z.string().url({ message: "Please enter a valid URL." }).or(z.literal('')),
  aiModelSettings: z.object({
      pro: z.string().optional(),
      proLabel: z.string().optional(),
      flash: z.string().optional(),
      flashLabel: z.string().optional(),
  }).optional(),
});


/**
 * Updates the global site settings.
 * @param settings The settings to update. This now accepts the full SiteSettings object.
 */
export async function updateSiteSettingsAction(settings: Partial<z.infer<typeof siteSettingsSchema>>): Promise<{ success: boolean; error?: string }> {
    try {
        const validation = siteSettingsSchema.safeParse(settings);
        if (!validation.success) {
            const firstError = validation.error.errors[0];
            throw new Error(`${firstError.path.join('.')}: ${firstError.message}`);
        }
        
        const dataToSave = validation.data;

        const docRef = adminDb.collection('siteSettings').doc('v1');
        await docRef.set(dataToSave, { merge: true });

        return { success: true };
    } catch (error: any) {
        console.error("Error updating site settings: ", error);
        return { success: false, error: error.message };
    }
}
