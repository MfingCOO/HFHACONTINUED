
'use server';

import { db as adminDb, admin } from '@/lib/firebaseAdmin';
import { z }from 'zod';
import { endOfDay } from 'date-fns';
import type { AvailabilitySettings, SiteSettings } from '@/types';

const eventSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Title is required."),
    start: z.date(),
    end: z.date(),
    description: z.string().optional(),
    clientId: z.string().optional().nullable(),
    clientName: z.string().optional().nullable(),
    isPersonal: z.boolean().default(false),
    attachVideoLink: z.boolean().default(false),
    coachId: z.string().optional().nullable(),
    coachName: z.string().optional().nullable(),
});

type CalendarEventInput = z.infer<typeof eventSchema>;

function serializeTimestamps(docData: any): any {
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

export async function getCoachEvents(startDate: Date, endDate: Date) {
    try {
        const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
        const endTimestamp = admin.firestore.Timestamp.fromDate(endOfDay(endDate));

        // This query is now corrected to use inequalities on a single field ('start'),
        // which is a valid Firestore query. This resolves the server error.
        const q = adminDb.collection('coachCalendar')
            .where('start', '>=', startTimestamp)
            .where('start', '<=', endTimestamp);
            
        const snapshot = await q.get();
        const events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...serializeTimestamps(doc.data())
        }));

        return { success: true, data: events };
    } catch (error: any) {
        console.error("Error fetching coach events:", error);
        return { success: false, error: error.message };
    }
}

export async function saveCalendarEvent(eventData: CalendarEventInput) {
    const validation = eventSchema.safeParse({
        ...eventData,
        start: new Date(eventData.start),
        end: new Date(eventData.end),
    });

    if (!validation.success) {
        return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
    }

    try {
        const { id, ...dataToSave } = validation.data;
        
        let finalEventData: any = {
            ...dataToSave,
            start: admin.firestore.Timestamp.fromDate(dataToSave.start),
            end: admin.firestore.Timestamp.fromDate(dataToSave.end),
            videoCallLink: null, // Ensure link is cleared by default
        };

        // If the coach explicitly wants to attach the video link.
        if (dataToSave.attachVideoLink) {
            const settingsDocRef = adminDb.collection('siteSettings').doc('v1');
            const settingsSnap = await settingsDocRef.get();
            if (settingsSnap.exists) {
                const siteSettings = settingsSnap.data() as SiteSettings;
                if (siteSettings.videoCallLink) {
                    finalEventData.videoCallLink = siteSettings.videoCallLink;
                }
            }
        }
        
        const eventRef = id ? adminDb.collection('coachCalendar').doc(id) : adminDb.collection('coachCalendar').doc();
        
        await eventRef.set(finalEventData, { merge: true });

        return { success: true, id: eventRef.id };
    } catch (error: any) {
        console.error("Error saving calendar event:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteCalendarEvent(eventId: string) {
    try {
        if (!eventId) {
            throw new Error("Event ID is required for deletion.");
        }
        await adminDb.collection('coachCalendar').doc(eventId).delete();
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting calendar event:", error);
        return { success: false, error: error.message };
    }
}


export async function saveCoachAvailability(settings: AvailabilitySettings): Promise<{ success: boolean; error?: string }> {
    try {
        const docRef = adminDb.collection('siteSettings').doc('v1');
        // The dates in `vacationBlocks` will be ISO strings from the client
        const availabilityData = {
            ...settings,
            vacationBlocks: settings.vacationBlocks.map(block => ({
                ...block,
                start: new Date(block.start),
                end: new Date(block.end),
            }))
        }
        await docRef.set({ availability: availabilityData }, { merge: true });
        return { success: true };
    } catch (error: any) {
        console.error("Error saving coach availability:", error);
        return { success: false, error: error.message };
    }
}


/**
 * Fetches both the coach availability rules and existing events for a given date range.
 * This is used by the client booking dialog to calculate available time slots.
 */
export async function getCoachAvailabilityAndEvents(startDate: Date, endDate: Date) {
    try {
        // Fetch general availability settings
        const settingsDocRef = adminDb.collection('siteSettings').doc('v1');
        const settingsSnap = await settingsDocRef.get();
        const siteSettings = settingsSnap.data() as SiteSettings | undefined;

        // The availability object needs to be serialized for the client
        const availability = siteSettings?.availability 
            ? {
                ...siteSettings.availability,
                vacationBlocks: siteSettings.availability.vacationBlocks?.map(block => ({
                    ...block,
                    start: (block.start as unknown as admin.firestore.Timestamp).toDate().toISOString(),
                    end: (block.end as unknown as admin.firestore.Timestamp).toDate().toISOString(),
                })) || []
            }
            : null;

        // Fetch existing events in the date range
        const eventsResult = await getCoachEvents(startDate, endDate);
        if (!eventsResult.success) {
            throw new Error(eventsResult.error || 'Failed to fetch existing events.');
        }

        return {
            success: true,
            data: {
                availability,
                events: eventsResult.data,
            }
        };

    } catch (error: any) {
        console.error("Error in getCoachAvailabilityAndEvents:", error);
        return { success: false, error: error.message };
    }
}
