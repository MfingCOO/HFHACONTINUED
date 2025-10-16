
import type { Timestamp } from 'firebase/firestore';

export type UserTier = 'free' | 'ad-free' | 'basic' | 'premium' | 'coaching';
export const TIER_ACCESS: [UserTier, ...UserTier[]] = ['free', 'ad-free', 'basic', 'premium', 'coaching'];


export interface TrackingSettings {
    units: 'imperial' | 'metric';
    nutrition: boolean;
    hydration: boolean;
    activity: boolean;
    sleep: boolean;
    stress: boolean; // for stress and cravings
    measurements: boolean;
    reminders: boolean; // global reminder toggle
}

export interface NutritionalGoals {
    // --- User choices that drive the calculation ---
    calculationMode: 'ideal' | 'actual' | 'custom';
    calorieModifier: number; // e.g., -500, 0, 250
    activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
    
    // --- User-overridden custom macro values ---
    protein?: number;
    fat?: number;
    carbs?: number;

    // --- Core Calculated Values ---
    
    /**
     * The user's Total Daily Energy Expenditure (TDEE).
     * This is a pure calculation of maintenance calories based on actual weight and activity level.
     * It is NOT affected by calorie goals or deficits.
     */
    tdee: number;

    /**
     * The user's final target calorie goal for intake.
     * This value IS affected by the user's choices (ideal vs actual mode, deficits/surpluses).
     */
    calorieGoal: number;

    /**
     * A +/- 10% range around the final calorieGoal for the user to aim for.
     */
    calorieGoalRange: {
        min: number;
        max: number;
    };
    
    // --- Final Macronutrient Goals ---
    // Note: These are now optional as they are part of the main object, not a sub-object
    fiber: number; // Static goal
}


export interface ClientProfile {
    uid: string;
    fullName: string;
    email: string;
    tier: UserTier;
    lastInteraction?: Timestamp;
    createdAt: Timestamp | string;
    suggestedHydrationGoal?: number;
    idealBodyWeight?: number; // The single source of truth for ideal weight
    bingeFreeSince?: Timestamp | string;
    lastBinge?: Timestamp | string;
    dailySummary?: {
        lastUpdated: Timestamp | string;
        age: number;
        sex: string;
        unit: 'kg' | 'lbs';
        startWeight: number | null;
        currentWeight: number | null;
        lastWeightDate: string | null;
        startWthr: number | null;
        currentWthr: number;
        lastWaistDate: string | null;
        avgSleep: number;
        avgActivity: number;
        avgHydration: number;
        cravings: number;
        binges: number;
        stressEvents: number;
        avgUpf: number;
        wthr: number; // Added for consistency
        avgNutrients: {
            Energy: number;
            Protein: number;
            'Total lipid (fat)': number;
            'Carbohydrate, by difference': number;
        };
    };
    onboarding?: {
        birthdate: string;
        sex: 'male' | 'female' | 'unspecified';
        units: 'imperial' | 'metric';
        height: number;
        weight: number;
        waist: number;
        zipCode: string;
        activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
        wakeTime: string;
        sleepTime: string;
    };
    trackingSettings?: Partial<TrackingSettings>;
    hydrationSettings?: {
        customGoal?: number;
        remindersEnabled?: boolean;
        reminderTimes?: string[]; // e.g. ["09:00", "12:00", "15:00"]
    };
    // This will hold the default, suggested goals, calculated once at onboarding.
    suggestedGoals?: Partial<NutritionalGoals>; 
    // This will hold the user's current, active goals, which can be modified.
    // It is now the single source of truth for all components.
    customGoals?: Partial<NutritionalGoals>;
    [key:string]: any; 
}

export interface UserProfile extends ClientProfile {
    // This extends ClientProfile to include all its properties
    // and adds the specific properties for the user's general profile.
    chatIds: string[];
    challengeIds: string[];
    role?: 'client' | 'coach';
}


export interface CoachNote {
    id: string;
    note: string;
    coachId: string;
    coachName: string;
    createdAt: string;
}

export interface CoachNotification {
    id: string;
    clientId: string;
    clientName: string;
    type: 'binge_event' | 'high_stress' | 'model_deprecation';
    message: string;
    timestamp: any; // Firestore timestamp
    read: boolean;
}

export interface CustomHabit {
    id: string;
    name: string;
    description: string;
}

export interface Challenge {
    id: string;
    name: string;
    description: string;
    dates: { from: Timestamp, to: Timestamp };
    maxParticipants: number;
    trackables: any[];
    thumbnailUrl: string;
    participants: string[];
    participantCount: number;
    points?: { [key: string]: number };
    streaks?: { [key: string]: { lastLog: Timestamp, count: number } };
    notes?: string;
    type: 'challenge';
    createdAt?: Timestamp;
    scheduledPillars?: {
        pillarId: string;
        days: string[];
        recurrenceType: 'weekly' | 'custom';
        recurrenceInterval?: number;
        notes?: string;
    }[];
    scheduledHabits?: {
        habitId: string;
        days: string[];
        recurrenceType: 'weekly' | 'custom';
        recurrenceInterval?: number;
    }[];
    customTasks?: {
        description: string;
        startDay: number;
        unit: 'reps' | 'seconds' | 'minutes';
        goalType: 'static' | 'progressive' | 'user-records';
        goal?: number;
        startingGoal?: number;
        increaseBy?: number;
        increaseEvery?: 'week' | '2-weeks' | 'month';
        notes?: string;
    }[];
    progress?: {
        [userId: string]: {
            [date: string]: { // format: yyyy-MM-dd
                [taskDescription: string]: boolean | number;
            }
        }
    }
}

export interface AvailabilitySettings {
  weekly: {
    day: string;
    enabled: boolean;
    slots: { start: string; end: string }[];
  }[];
  vacationBlocks: {
    start: Date | string;
    end: Date | string;
    notes?: string;
  }[];
}

export interface SiteSettings {
    url: string;
    videoCallLink?: string;
    availability?: AvailabilitySettings;
    aiModelSettings?: {
        pro: string;
        proLabel?: string;
        flash: string;
        flashLabel?: string;
        vision: string;
    };
}

export interface ChatMessage {
    id: string;
    text?: string;
    userId: string;
    userName: string;
    timestamp: string; // Serialized as ISO string for client
    isSystemMessage?: boolean;
    fileUrl?: string;
    fileName?: string;
}
