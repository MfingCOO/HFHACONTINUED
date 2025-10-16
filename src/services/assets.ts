

'use server';
import { db } from '@/lib/firebaseAdmin';

export interface AssetLibrary {
    dashboardBannerUrl?: string;
    calendarBannerUrl?: string;
    dailySummaryPopupUrl?: string;
    nutritionPopupUrl?: string;
    activityPopupUrl?: string;
    sleepPopupUrl?: string;
    stressPopupUrl?: string;
    hydrationPopupUrl?: string;
    protocolPopupUrl?: string;
    plannerPopupUrl?: string;
    cravingsPopupUrl?: string;
    insightsPopupUrl?: string;
    measurementsPopupUrl?: string;
}

/**
 * Securely fetches the asset library using the Firebase Admin SDK.
 * This is a server action and is not subject to client-side security rules.
 */
export async function getAssetLibrary(): Promise<{ success: boolean; data?: AssetLibrary; error?: any; }> {
    try {
        const docRef = db.collection('asset-library').doc('v1');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            return { success: true, data: docSnap.data() as AssetLibrary };
        } else {
            console.warn("Asset library document 'asset-library/v1' not found. Creating it.");
            // Document doesn't exist, so create it with a placeholder.
            const placeholderData: AssetLibrary = {
                dashboardBannerUrl: "https://placehold.co/1200x400.png"
            };
            await docRef.set(placeholderData);
            return { success: true, data: placeholderData };
        }
    } catch (error: any) {
        console.error("Error fetching asset library: ", error);
        return { success: false, error: { message: error.message } };
    }
}

    