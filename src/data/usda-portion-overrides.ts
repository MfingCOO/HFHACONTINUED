
// src/data/usda-portion-overrides.ts

export const USDA_PORTION_OVERRIDES: Record<number, { portionDescription: string; gramWeight: number }[]> = {
  // fdcId for: "Eggs, Grade A, Large, egg white, raw, fresh"
  171282: [
    {
      "portionDescription": "1 egg white (large)",
      "gramWeight": 33, // A typical large egg white is ~33g
    }
  ],
  // Add other items here as they are discovered
};
