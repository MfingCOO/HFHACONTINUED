
'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import type { CustomHabit } from '@/types';

// Schema for validating habit creation/updates
const habitSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(3, 'Habit name must be at least 3 characters.'),
    description: z.string().min(5, 'Description must be at least 5 characters.'),
});

/**
 * Fetches all custom habits from the library.
 */
export async function getCustomHabitsAction(): Promise<{ success: boolean; data?: CustomHabit[]; error?: string }> {
    try {
        const snapshot = await adminDb.collection('customHabits').orderBy('name', 'asc').get();
        const habits = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            description: doc.data().description,
        } as CustomHabit));
        return { success: true, data: habits };
    } catch (error: any) {
        console.error('Error fetching custom habits:', error);
        return { success: false, error: error.message };
    }
}


/**
 * Creates or updates a custom habit in the library.
 */
export async function saveCustomHabitAction(data: { id?: string; name: string; description: string }): Promise<{ success: boolean; id?: string; error?: string }> {
    const validation = habitSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
    }
    
    try {
        const { id, name, description } = validation.data;
        const habitData = { name, description };
        
        if (id) {
            // Update existing habit
            await adminDb.collection('customHabits').doc(id).set(habitData, { merge: true });
            return { success: true, id };
        } else {
            // Create new habit
            const newDocRef = await adminDb.collection('customHabits').add(habitData);
            return { success: true, id: newDocRef.id };
        }
    } catch (error: any) {
        console.error('Error saving custom habit:', error);
        return { success: false, error: error.message };
    }
}


/**
 * Deletes a custom habit from the library.
 */
export async function deleteCustomHabitAction(habitId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!habitId) {
            throw new Error('Habit ID is required for deletion.');
        }
        await adminDb.collection('customHabits').doc(habitId).delete();
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting custom habit:', error);
        return { success: false, error: error.message };
    }
}
