/**
 * @fileoverview This file contains the optimal daily nutritional allowances
 * based on modern research for promoting optimal health, rather than just
 * preventing deficiency. These values are used throughout the app for
 * nutritional calculations and recommendations.
 */

export const rda: Record<string, { value: number, unit: string, description?: string }> = {
    // Macronutrients
    'Energy': { value: 2000, unit: 'kcal', description: "The energy your body needs to function. Optimal intake depends on activity level and goals." },
    'Protein': { value: 1.2, unit: 'g/kg', description: "Essential for building muscle, repairing tissue, and creating hormones. Crucial for satiety and hunger management." }, // Note: This is per kg of body weight
    'Total lipid (fat)': { value: 78, unit: 'g', description: "Provides energy and supports cell growth, hormone production, and nutrient absorption." },
    'Carbohydrate, by difference': { value: 275, unit: 'g', description: "The body's primary source of energy, but quality matters. Focus on complex carbs from whole foods." },

    // Vitamins - Using optimal intakes based on clinical data
    'Vitamin D (D2 + D3)': { value: 4000, unit: 'IU', description: "Critical for immune function, hormone balance, and mood. Optimal levels are linked to reduced inflammation and cravings." }, 
    'Vitamin C, total ascorbic acid': { value: 500, unit: 'mg', description: "A powerful antioxidant that supports the immune system, skin health, and helps manage stress. Aids in recovery." },
    'Vitamin B-12': { value: 100, unit: 'µg', description: "Essential for nerve function and energy production. Optimal levels help prevent brain fog and support mood." },
    'Vitamin A, RAE': { value: 900, unit: 'µg', description: "Supports vision, immune function, and cellular communication. Best obtained from a varied diet." },
    'Vitamin E (alpha-tocopherol)': { value: 200, unit: 'mg', description: "A key antioxidant that protects cells from oxidative stress, supporting skin health and reducing inflammation." }, 
    'Vitamin K (phylloquinone)': { value: 180, unit: 'µg', description: "Works with Vitamin D to direct calcium to bones, supporting skeletal and cardiovascular health." }, // This is K1+K2, optimal for K2 is 100-200mcg
    'Thiamin': { value: 1.2, unit: 'mg', description: "Also known as Vitamin B1, it's vital for energy metabolism and proper nerve function." },
    'Riboflavin': { value: 1.3, unit: 'mg', description: "Vitamin B2, important for energy production, cellular growth, and breaking down fats and medications." },
    'Niacin': { value: 16, unit: 'mg', description: "Vitamin B3, helps convert food into energy and supports the nervous and digestive systems." },
    'Vitamin B-6': { value: 75, unit: 'mg', description: "Crucial for mood regulation (serotonin production), immune response, and metabolism. Optimal levels can help with PMS symptoms." },
    'Folate, total': { value: 600, unit: 'µg', description: "Essential for cell growth and DNA formation. Supports nerve function and helps regulate mood." }, // DFE
    

    // Minerals - Using optimal intakes
    'Magnesium, Mg': { value: 650, unit: 'mg', description: "A master mineral for over 300 functions, including muscle relaxation, stress management, sleep quality, and blood sugar control." },
    'Potassium, K': { value: 4100, unit: 'mg', description: "An electrolyte that helps regulate fluid balance, nerve signals, and muscle contractions. Key for blood pressure management." },
    'Zinc, Zn': { value: 30, unit: 'mg', description: "Crucial for a strong immune system, wound healing, and hormone production, including appetite-regulating hormones." },
    'Calcium, Ca': { value: 1200, unit: 'mg', description: "Vital for bone health, but must be balanced with Vitamins D and K2. Best sourced from diet." },
    'Selenium, Se': { value: 150, unit: 'µg', description: "A powerful antioxidant that is essential for thyroid function, which governs metabolism and energy levels." },
    'Iron, Fe': { value: 25, unit: 'mg', description: "Necessary for creating hemoglobin to transport oxygen. Optimal levels are key for energy and preventing fatigue." },
    'Sodium, Na': { value: 2300, unit: 'mg', description: "An important electrolyte, but intake should be monitored. Primarily from whole foods, not processed ones." },
    'Iodine': { value: 250, unit: 'mcg', description: "Essential for the production of thyroid hormones, which regulate metabolism, energy, and cognitive function."},
    'Copper, Cu': { value: 1.3, unit: 'mg', description: "Works with iron to form red blood cells and supports blood vessels, nerves, and immune function." },
    'Chromium': { value: 500, unit: 'mcg', description: "Enhances the action of insulin, playing a key role in stabilizing blood sugar and reducing cravings." },
    'Manganese': { value: 2.0, unit: 'mg', description: "Contributes to bone formation, metabolism, and antioxidant defenses against cellular damage." },


    // Other - Using optimal intakes
    'Omega-3s (EPA/DHA)': { value: 1500, unit: 'mg', description: "Potent anti-inflammatory fats that support brain health, mood stability, and cardiovascular function." },
    'Fiber, total dietary': { value: 35, unit: 'g', description: "Crucial for digestive health, satiety, and stabilizing blood sugar. Aim for sources from whole foods." },
    'Sugars, added': { value: 0, unit: 'g', description: "Added sugars should be eliminated to stabilize blood sugar, manage hunger signals, and reduce inflammation." },
    'Cholesterol': { value: 300, unit: 'mg', description: "Your body produces most of what it needs. Dietary cholesterol has less impact than previously thought, but quality matters." },
    'Fatty acids, total saturated': { value: 20, unit: 'g', description: "Limit for cardiovascular health. Focus on unsaturated fats from whole food sources like nuts and avocados." },
};
