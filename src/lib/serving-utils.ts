import type { Food } from '@/types/foods';

/**
 * Intelligently selects the best default serving option from a food's serving list.
 * The backend now guarantees the best option is the first in the array,
 * so this function is now simplified to just return the first element.
 *
 * @param food - The Food object containing an array of `servingOptions`.
 * @returns The best serving option object to display by default.
 */
export const getBestDefaultServing = (food: Food) => {
    if (!food.servingOptions || food.servingOptions.length === 0) {
        // This should not happen if the data fetching tool works correctly, but it's a safe fallback.
        return { label: '100g', grams: 100 };
    }

    // The backend now pre-sorts the servingOptions array, so the best option is always the first one.
    return food.servingOptions[0];
};
