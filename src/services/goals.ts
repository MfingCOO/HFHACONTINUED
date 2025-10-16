
import type { ClientProfile, NutritionalGoals } from '@/types';
import { differenceInYears } from 'date-fns';

/**
 * @fileoverview This file contains the single, authoritative service for calculating
 * personalized nutritional goals. It now calculates all three goal types (Ideal, Actual, Custom)
 * and returns them in a structured object for the UI to consume.
 */

const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
};

// The new return type for our comprehensive calculator
export interface AllGoalSets {
    idealGoals: NutritionalGoals;
    actualGoals: NutritionalGoals;
    customGoals: NutritionalGoals;
}


/**
 * Calculates all three sets of potential nutritional goals for a client.
 * This is the new single source of truth for all goal calculations.
 *
 * @param clientProfile The client's profile, including onboarding data and saved custom goals.
 * @returns An object containing `idealGoals`, `actualGoals`, and `customGoals`.
 */
export function calculateNutritionalGoals(clientProfile: ClientProfile): AllGoalSets {
    const { onboarding, customGoals = {}, idealBodyWeight } = clientProfile;
    
    // Safeguard for missing onboarding data
    if (!onboarding) {
        const defaultGoals: NutritionalGoals = {
            calculationMode: 'ideal', calorieModifier: 0, activityLevel: 'light',
            tdee: 2000, calorieGoal: 2000, calorieGoalRange: { min: 1800, max: 2200 },
            protein: 150, fat: 60, carbs: 215, fiber: 35
        };
        return { idealGoals: defaultGoals, actualGoals: defaultGoals, customGoals: defaultGoals };
    }
    
    const { birthdate, height, units, weight: actualWeight } = onboarding;
    const sex = onboarding.sex === 'unspecified' ? 'male' : onboarding.sex;
    const age = differenceInYears(new Date(), new Date(birthdate));
    
    const heightInCm = units === 'imperial' ? height * 2.54 : height;
    const actualWeightKg = units === 'imperial' ? actualWeight * 0.453592 : actualWeight;
    
    // Use the activity level from the user's current settings for all calculations.
    const activityLevel = customGoals.activityLevel || onboarding.activityLevel || 'light';
    const activityMultiplier = activityMultipliers[activityLevel];

    // --- Core Calculations ---
    const actualBmr = (10 * actualWeightKg) + (6.25 * heightInCm) - (5 * age) + (sex === 'male' ? 5 : -161);
    const tdee = actualBmr * activityMultiplier;

    const finalIdealWeightLbs = idealBodyWeight || (units === 'metric' ? actualWeight * 2.20462 : actualWeight);
    const idealWeightKg = finalIdealWeightLbs * 0.453592;
    const idealBmr = (10 * idealWeightKg) + (6.25 * heightInCm) - (5 * age) + (sex === 'male' ? 5 : -161);
    
    // --- 1. Calculate the "Ideal Goals" set ---
    const idealCalorieGoal = idealBmr * activityMultiplier;
    const idealProtein = Math.round(finalIdealWeightLbs);
    const idealFat = sex === 'male' ? 100 : 50;
    const idealCarbs = Math.round((idealCalorieGoal - (idealProtein * 4) - (idealFat * 9)) / 4);
    
    const idealGoals: NutritionalGoals = {
        calculationMode: 'ideal',
        calorieModifier: 0,
        activityLevel,
        tdee: Math.round(tdee),
        calorieGoal: Math.round(idealCalorieGoal),
        calorieGoalRange: { min: Math.round(idealCalorieGoal * 0.9), max: Math.round(idealCalorieGoal * 1.1) },
        protein: idealProtein,
        fat: idealFat,
        carbs: Math.max(0, idealCarbs),
        fiber: 35
    };

    // --- 2. Calculate the "Actual Goals" set ---
    const actualCalorieGoal = tdee + (customGoals.calorieModifier || 0);
    // Protein and Fat suggestions are always based on the safer ideal weight.
    const actualProtein = idealProtein; 
    const actualFat = idealFat;
    const actualCarbs = Math.round((actualCalorieGoal - (actualProtein * 4) - (actualFat * 9)) / 4);

    const actualGoals: NutritionalGoals = {
        calculationMode: 'actual',
        calorieModifier: customGoals.calorieModifier || 0,
        activityLevel,
        tdee: Math.round(tdee),
        calorieGoal: Math.round(actualCalorieGoal),
        calorieGoalRange: { min: Math.round(actualCalorieGoal * 0.9), max: Math.round(actualCalorieGoal * 1.1) },
        protein: actualProtein,
        fat: actualFat,
        carbs: Math.max(0, actualCarbs),
        fiber: 35
    };

    // --- 3. Assemble the "Custom Goals" set ---
    // If custom macros are set, calculate calorie goal from them. Otherwise, default to the 'actual' goal.
    let customCalorieGoal = actualCalorieGoal;
    if (customGoals.calculationMode === 'custom' && (customGoals.protein || customGoals.fat || customGoals.carbs)) {
        customCalorieGoal = (customGoals.protein || 0) * 4 + (customGoals.fat || 0) * 9 + (customGoals.carbs || 0) * 4;
    }
    
    const finalCustomGoals: NutritionalGoals = {
        ...actualGoals, // Start with 'actual' as a base
        ...customGoals, // Overlay any saved custom preferences
        calculationMode: customGoals.calculationMode || 'actual',
        calorieGoal: Math.round(customCalorieGoal),
        calorieGoalRange: { min: Math.round(customCalorieGoal * 0.9), max: Math.round(customCalorieGoal * 1.1) },
        // Ensure the final macros are the custom ones if they exist, otherwise fall back to 'actual'
        protein: customGoals.protein || actualGoals.protein,
        fat: customGoals.fat || actualGoals.fat,
        carbs: customGoals.carbs ?? actualGoals.carbs,
    };
    

    return {
        idealGoals,
        actualGoals,
        customGoals: finalCustomGoals
    };
}
