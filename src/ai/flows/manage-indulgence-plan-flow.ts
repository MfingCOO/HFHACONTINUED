
'use server';
/**
 * @fileOverview A unified Genkit flow to manage the lifecycle of all scheduled events,
 * including indulgence plans and pop-up campaigns. This flow is designed to be
 * run by a recurring cron job.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db, admin } from '@/lib/firebaseAdmin';
import { sendScheduledPopupNotification } from '@/services/reminders';

// This is the new master flow for all scheduled events.
export const processScheduledEventsFlow = ai.defineFlow(
  {
    name: 'processScheduledEventsFlow',
    inputSchema: z.object({ dryRun: z.boolean().optional().default(false) }),
    outputSchema: z.object({ 
      processedPlans: z.number(),
      activatedPlans: z.number(),
      completedPlans: z.number(),
      processedPopups: z.number(),
      activatedPopups: z.number(),
      completedPopups: z.number(),
    }),
  },
  async ({ dryRun }) => {
    console.log(`Running master scheduled event processing... ${dryRun ? '[DRY RUN]' : ''}`);
    const now = admin.firestore.Timestamp.now();
    const twentyFourHoursAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);
    
    let activatedPlans = 0;
    let completedPlans = 0;
    let activatedPopups = 0;
    let completedPopups = 0;

    const masterBatch = db.batch();

    // --- 1. Process Indulgence Plans ---
    const plannedIndulgenceQuery = db.collection('indulgencePlans')
        .where('status', '==', 'planned')
        .where('indulgenceDate', '<=', now);

    const activeIndulgenceQuery = db.collection('indulgencePlans')
        .where('status', '==', 'active')
        .where('indulgenceDate', '<=', twentyFourHoursAgo);

    const [plannedIndulgenceSnapshot, activeIndulgenceSnapshot] = await Promise.all([
      plannedIndulgenceQuery.get(),
      activeIndulgenceQuery.get(),
    ]);
    
    if (!plannedIndulgenceSnapshot.empty) {
        plannedIndulgenceSnapshot.forEach(doc => {
            console.log(`Activating indulgence plan ${doc.id}`);
            masterBatch.update(doc.ref, { status: 'active' });
            activatedPlans++;
        });
    }
    
    if (!activeIndulgenceSnapshot.empty) {
        activeIndulgenceSnapshot.forEach(doc => {
            console.log(`Completing indulgence plan ${doc.id}`);
            masterBatch.update(doc.ref, { status: 'completed' });
            completedPlans++;
        });
    }
    
    // --- 2. Process Pop-up Campaigns ---
    const scheduledPopupsQuery = db.collection('popups')
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now);
    
    const activePopupsQuery = db.collection('popups')
      .where('status', '==', 'active')
      .where('scheduledAt', '<=', twentyFourHoursAgo);

    const [scheduledPopupsSnapshot, activePopupsSnapshot] = await Promise.all([
        scheduledPopupsQuery.get(),
        activePopupsQuery.get(),
    ]);

    // Process and deliver scheduled pop-ups
    if (!scheduledPopupsSnapshot.empty) {
        const deliveryPromises = scheduledPopupsSnapshot.docs.map(async (doc) => {
            const popupData = { id: doc.id, ...doc.data() };
            console.log(`Delivering scheduled pop-up: ${popupData.name} (ID: ${popupData.id})`);
            // This is the critical missing line that actually delivers the notification.
            await sendScheduledPopupNotification(popupData);
            masterBatch.update(doc.ref, { status: 'active' });
            activatedPopups++;
        });
        await Promise.all(deliveryPromises);
    }

    // Mark old active pop-ups as completed
    if (!activePopupsSnapshot.empty) {
        activePopupsSnapshot.forEach(doc => {
            console.log(`Ending active pop-up ${doc.id}`);
            masterBatch.update(doc.ref, { status: 'ended' });
            completedPopups++;
        });
    }

    // --- 3. Commit all changes ---
    if (!dryRun) {
        await masterBatch.commit();
    }
    
    const processedPlans = activatedPlans + completedPlans;
    const processedPopups = activatedPopups + completedPopups;
    console.log(`Processed ${processedPlans} indulgence plans and ${processedPopups} pop-ups.`);
    
    return { 
      processedPlans, 
      activatedPlans, 
      completedPlans,
      processedPopups,
      activatedPopups,
      completedPopups
    };
  }
);
