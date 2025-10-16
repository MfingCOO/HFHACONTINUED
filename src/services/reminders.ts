
'use server';

import { db, admin } from '@/lib/firebaseAdmin';
import { UserProfile, UserTier, Challenge } from '@/types';
import { startOfDay, format, subDays, addDays } from 'date-fns';
import { FieldValue } from 'firebase-admin/firestore';


export interface Reminder {
    id: string; // Add ID to the reminder interface
    type: 'log' | 'reflect' | 'upgrade' | 'streak-congrats' | 'indulgence-prep' | 'indulgence-follow-up' | 'custom-popup';
    title: string;
    message: string;
    pillarId: string;
    requiredTier?: UserTier;
    data?: any; // To carry payload like streak pillars or indulgence plans
}

/**
 * Creates a notification document in the user's private notification sub-collection.
 * This is the new "push-to-mailbox" mechanism.
 */
async function createUserNotification(userId: string, reminder: Omit<Reminder, 'id'>) {
    if (!userId) return;
    const notificationRef = db.collection(`clients/${userId}/notifications`).doc();
    await notificationRef.set({
        ...reminder,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        seen: false, // For future use if needed
    });
    // Return the full reminder object including the new ID
    return { id: notificationRef.id, ...reminder };
}


/**
 * Deletes a notification from a user's mailbox after it has been acknowledged.
 */
export async function dismissReminderAction(userId: string, notificationId: string): Promise<{ success: boolean; error?: string; }> {
    try {
        if (!userId || !notificationId) {
            throw new Error("User ID and Notification ID are required.");
        }
        await db.collection(`clients/${userId}/notifications`).doc(notificationId).delete();
        return { success: true };
    } catch (error: any) {
        console.error("Error dismissing reminder: ", error);
        return { success: false, error: error.message };
    }
}


/**
 * Sends a pop-up by creating a notification document in the target user's mailbox.
 */
export async function sendScheduledPopupNotification(popupData: any) {
  try {
    const { targetType, targetValue, title, message, id, ...restData } = popupData;
    let targetUserIds: string[] = [];
    const userProfilesRef = db.collection('userProfiles');

    // Determine the target audience
    if (targetType === 'all') {
      const snapshot = await userProfilesRef.get();
      snapshot.forEach(doc => targetUserIds.push(doc.id));
    } else if (targetType === 'tier' && targetValue) {
      const snapshot = await userProfilesRef.where('tier', '==', targetValue).get();
      snapshot.forEach(doc => targetUserIds.push(doc.id));
    } else if (targetType === 'user' && targetValue) {
      targetUserIds.push(targetValue);
    }
    
    targetUserIds = [...new Set(targetUserIds)]; 

    if (targetUserIds.length > 0) {
      const reminderPayload: Omit<Reminder, 'id'> = {
          type: 'custom-popup',
          title: title,
          message: message,
          pillarId: 'megaphone',
          data: {
              id: id,
              imageUrl: restData.imageUrl || '',
              ctaText: restData.ctaText || '',
              ctaUrl: restData.ctaUrl || '',
          }
      };

      console.log(`Delivering pop-up "${title}" to ${targetUserIds.length} users' mailboxes.`);
      const promises = targetUserIds.map(uid => createUserNotification(uid, reminderPayload));
      await Promise.all(promises);
    }

    return { success: true };

  } catch (error: any) {
    console.error(`Error in sendScheduledPopupNotification for popup ${popupData.id}:`, error);
    return { success: false, error: error.message };
  }
}


/**
 * Calculates all occurrences of a scheduled habit within a challenge's date range.
 */
function getHabitOccurrences(habit: any, challenge: Challenge) {
    const occurrences: Date[] = [];
    if (!challenge.dates.from || !challenge.dates.to) return occurrences;
    
    const challengeStartDate = (challenge.dates.from as any).toDate();
    const challengeEndDate = (challenge.dates.to as any).toDate();
    const totalChallengeDays = Math.ceil((challengeEndDate.getTime() - challengeStartDate.getTime()) / (1000 * 3600 * 24));
    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

    const recurrenceCycle = habit.recurrenceType === 'weekly' ? 7 : habit.recurrenceInterval;
    if (!recurrenceCycle) return [];

    for (let dayOffset = 0; dayOffset < totalChallengeDays; dayOffset += recurrenceCycle) {
        for (const dayOfWeek of habit.days) {
            const dayIndex = dayMap[dayOfWeek as keyof typeof dayMap];
            let firstOccurrenceInCycle = 0;
            
            while(new Date(challengeStartDate.getTime() + (dayOffset + firstOccurrenceInCycle) * 86400000).getDay() !== dayIndex && firstOccurrenceInCycle < recurrenceCycle) {
                firstOccurrenceInCycle++;
            }
            
            const habitDate = new Date(challengeStartDate.getTime() + (dayOffset + firstOccurrenceInCycle) * 86400000);

            if (habitDate <= challengeEndDate && habitDate.getDay() === dayIndex) {
                 occurrences.push(habitDate);
            }
        }
    }
    return occurrences;
}

const ALL_TRACKABLE_PILLARS = [
    'nutrition', 'hydration', 'activity', 'sleep', 
    'stress', 'measurements', 'protocol', 'wthr'
];


export async function getReminderAction(userId: string): Promise<{ success: boolean; reminder?: Reminder | null; error?: string }> {
    try {
        // --- HIGHEST PRIORITY: Check for explicit notifications in the user's mailbox ---
        const notificationsRef = db.collection(`clients/${userId}/notifications`).orderBy('createdAt').limit(1);
        const notificationSnapshot = await notificationsRef.get();
        if (!notificationSnapshot.empty) {
            const notificationDoc = notificationSnapshot.docs[0];
            const reminder = {
                id: notificationDoc.id,
                ...notificationDoc.data()
            } as Reminder;
            // Found a direct notification, return it immediately.
            return { success: true, reminder: reminder };
        }


        // --- If no mailbox notifications, proceed with algorithmic checks ---
        const userProfileRef = db.collection('userProfiles').doc(userId);
        const clientRef = db.collection('clients').doc(userId);

        const [userProfileSnap, clientSnap] = await Promise.all([userProfileRef.get(), clientRef.get()]);

        if (!userProfileSnap.exists || !clientSnap.exists) {
            return { success: false, error: 'User profile not found.' };
        }

        const userProfile = userProfileSnap.data() as UserProfile;
        const trackingSettings = userProfile.trackingSettings || {};
        const now = new Date();
        const hour = now.getHours();

        const todayStart = startOfDay(now);
        const todayStartTimestamp = admin.firestore.Timestamp.fromDate(todayStart);
        
        let reminderToSend: Omit<Reminder, 'id'> | null = null;
        
        // --- Algorithmic "Forgot to Log" Reminders ---

        // 1. Sleep Log Reminder
        if (trackingSettings.sleep !== false) {
            const wakeTime = userProfile.onboarding?.wakeTime; // e.g., "07:00"
            if (wakeTime) {
                const [wakeHour] = wakeTime.split(':').map(Number);
                const reminderTime = wakeHour + 2;
                if (hour === reminderTime) {
                    const sleepQuery = await db.collection(`clients/${userId}/sleep`)
                        .where('wakeUpDay', '==', todayStartTimestamp)
                        .limit(1).get();

                    if (sleepQuery.empty) {
                        reminderToSend = {
                            type: 'log',
                            title: 'Good Morning!',
                            message: 'How did you sleep? Let\'s log it to see how it affects your day.',
                            pillarId: 'sleep'
                        };
                    }
                }
            }
        }
        
        // 2. Hydration Log Reminder (if no other reminder is set)
        if (!reminderToSend && trackingSettings.hydration !== false) {
             const wakeTime = userProfile.onboarding?.wakeTime; // e.g., "07:00"
            if (wakeTime) {
                const [wakeHour] = wakeTime.split(':').map(Number);
                const reminderTime = wakeHour + 3;
                if (hour === reminderTime) {
                    const hydrationQuery = await db.collection(`clients/${userId}/hydration`)
                        .where('entryDate', '>=', todayStartTimestamp)
                        .limit(1).get();
                    
                    if (hydrationQuery.empty) {
                         reminderToSend = {
                            type: 'log',
                            title: 'Time to Hydrate!',
                            message: 'Have you had anything to drink yet? Logging your water intake is key.',
                            pillarId: 'hydration'
                        };
                    }
                }
            }
        }

        // 3. Nutrition Log Reminder (if no other reminder is set)
        if (!reminderToSend && trackingSettings.nutrition !== false) {
             const sleepTime = userProfile.onboarding?.sleepTime; // e.g., "22:00"
            if (sleepTime) {
                const [sleepHour] = sleepTime.split(':').map(Number);
                const reminderTime = (sleepHour - 3 + 24) % 24; // 3 hours before bed
                 if (hour === reminderTime) {
                    const nutritionQuery = await db.collection(`clients/${userId}/nutrition`)
                        .where('entryDate', '>=', todayStartTimestamp)
                        .limit(1).get();
                    
                    if (nutritionQuery.empty) {
                         reminderToSend = {
                            type: 'log',
                            title: 'Dinner Time?',
                            message: 'Don\'t forget to log your meals for today to get the best insights.',
                            pillarId: 'nutrition'
                        };
                    }
                }
            }
        }

        // --- MEDIUM PRIORITY: Indulgence Planner Reminders ---
        if(!reminderToSend) {
            const indulgenceTodayQuery = await db.collection('indulgencePlans')
                .where('userId', '==', userId)
                .where('indulgenceDate', '==', todayStartTimestamp)
                .where('status', '==', 'active')
                .limit(1).get();
            
            if (!indulgenceTodayQuery.empty) {
                const wakeTime = userProfile.onboarding?.wakeTime;
                if(wakeTime) {
                    const [wakeHour] = wakeTime.split(':').map(Number);
                    if(hour === wakeHour + 4) { // 4 hours after waking
                         const plan = indulgenceTodayQuery.docs[0].data();
                         reminderToSend = {
                            type: 'indulgence-prep',
                            title: `Indulgence Today: ${plan.plannedIndulgence}`,
                            message: `Remember your plan to enjoy it guilt-free!`,
                            pillarId: 'planner',
                            data: plan
                        };
                    }
                }
            }
        }

        // Day-after follow-up reminder
        if(!reminderToSend) {
            const yesterdayStart = startOfDay(subDays(now, 1));
            const yesterdayStartTimestamp = admin.firestore.Timestamp.fromDate(yesterdayStart);
            const indulgenceYesterdayQuery = await db.collection('indulgencePlans')
                .where('userId', '==', userId)
                .where('indulgenceDate', '==', yesterdayStartTimestamp)
                .where('status', '==', 'completed')
                .limit(1).get();

             if (!indulgenceYesterdayQuery.empty) {
                 const wakeTime = userProfile.onboarding?.wakeTime;
                 if(wakeTime) {
                    const [wakeHour] = wakeTime.split(':').map(Number);
                    if(hour === wakeHour + 1) { // 1 hour after waking
                        const plan = indulgenceYesterdayQuery.docs[0].data();
                         reminderToSend = {
                            type: 'indulgence-follow-up',
                            title: 'How Was Your Indulgence?',
                            message: `Let's reflect on the experience and get back on track with your post-indulgence meal plan.`,
                            pillarId: 'planner',
                            data: plan
                        };
                    }
                 }
             }
        }

        // --- LOWER PRIORITY: Streak & Challenge Reminders ---
        
        // 4. 7-Day Streak Congratulations
        if(!reminderToSend) {
            const lastStreakNotification = (clientSnap.data()?.lastStreakNotification as admin.firestore.Timestamp | undefined)?.toDate();
            // Only check for streaks once per day
            if (!lastStreakNotification || startOfDay(lastStreakNotification) < todayStart) {
                const sevenDaysAgo = startOfDay(subDays(now, 6));
                const sevenDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(sevenDaysAgo);
                
                const logPromises = ALL_TRACKABLE_PILLARS.map(pillar => 
                    db.collection(`clients/${userId}/${pillar}`).where('entryDate', '>=', sevenDaysAgoTimestamp).get()
                );
                const pillarSnapshots = await Promise.all(logPromises);

                const loggedDaysByPillar: Record<string, Set<string>> = {};
                pillarSnapshots.forEach((snapshot, index) => {
                    const pillarId = ALL_TRACKABLE_PILLARS[index];
                    if (!loggedDaysByPillar[pillarId]) loggedDaysByPillar[pillarId] = new Set();
                    snapshot.forEach(doc => {
                        const entryDate = (doc.data().entryDate as admin.firestore.Timestamp).toDate();
                        loggedDaysByPillar[pillarId].add(format(entryDate, 'yyyy-MM-dd'));
                    });
                });

                const streakedPillars: string[] = [];
                for (const pillarId of ALL_TRACKABLE_PILLARS) {
                    let hasLoggedAllDays = true;
                    for (let i = 0; i < 7; i++) {
                        const checkDate = format(subDays(now, i), 'yyyy-MM-dd');
                        if (!loggedDaysByPillar[pillarId]?.has(checkDate)) {
                            hasLoggedAllDays = false;
                            break;
                        }
                    }
                    if (hasLoggedAllDays) {
                        streakedPillars.push(pillarId);
                    }
                }

                if (streakedPillars.length > 0) {
                    await clientRef.update({ lastStreakNotification: admin.firestore.FieldValue.serverTimestamp() });
                    reminderToSend = {
                        type: 'streak-congrats',
                        title: 'Incredible Consistency!',
                        message: `You've successfully logged these pillars for 7 days straight!`,
                        pillarId: 'challenges',
                        data: { pillars: streakedPillars }
                    };
                }
            }
        }


        // 5. Scheduled Challenge Habit Reminders
        if (!reminderToSend && userProfile.challengeIds && userProfile.challengeIds.length > 0) {
            const challengesQuery = await db.collection('challenges').where(admin.firestore.FieldPath.documentId(), 'in', userProfile.challengeIds).get();
            const challenges = challengesQuery.docs.map(doc => ({ id: doc.id, ...doc.data() } as Challenge));
            
            for (const challenge of challenges) {
                if (challenge.scheduledHabits) {
                    for (const habit of challenge.scheduledHabits) {
                        const habitOccurrences = getHabitOccurrences(habit, challenge);
                        const isDueToday = habitOccurrences.some(d => d.toDateString() === now.toDateString());

                        if (isDueToday) {
                            const habitDetails = (await db.collection('customHabits').doc(habit.habitId).get()).data();
                            if (!habitDetails) continue;

                            const todayString = format(startOfDay(now), 'yyyy-MM-dd');
                            const isCompleted = !!challenge.progress?.[userId]?.[todayString]?.[habitDetails.name];
                            
                            if (!isCompleted) {
                                const sleepTime = userProfile.onboarding?.sleepTime;
                                if (sleepTime) {
                                    const [sleepHour] = sleepTime.split(':').map(Number);
                                    const reminderStartHour = (sleepHour - 2 + 24) % 24;

                                    if (hour === reminderStartHour) {
                                        reminderToSend = {
                                            type: 'log',
                                            title: `Challenge: ${habitDetails.name}`,
                                            message: habitDetails.description,
                                            pillarId: 'challenges'
                                        };
                                        break; // Exit inner loop
                                    }
                                }
                            }
                        }
                    }
                }
                if(reminderToSend) break; // Exit outer loop
            }
        }

        // If an algorithmic reminder was found, create a notification for it and return it.
        if (reminderToSend) {
            const newReminder = await createUserNotification(userId, reminderToSend);
            return { success: true, reminder: newReminder as Reminder };
        }

        // If no reminders were found, return null.
        return { success: true, reminder: null };

    } catch (error: any) {
        console.error("Error in getReminderAction: ", error);
        return { success: false, error: error.message };
    }
}

    