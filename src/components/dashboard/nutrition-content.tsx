'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, Search, PlusCircle, Trash2, X, UtensilsCrossed, ShieldAlert, Beef, Wheat, Brain, Sprout } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { searchAndAnalyzeFoods, EnrichedFoodSearchOutput, EnrichedFoodItem } from '@/ai/flows/search-and-analyze-foods';
import type { Food, DetectUpfOutput, FoodAttributes } from '@/types/foods';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../auth/auth-provider';
import { cn } from '@/lib/utils';
import { BaseModal } from '../ui/base-modal';
import { AppNumberInput } from '../ui/number-input';
import { getBestDefaultServing } from '@/lib/serving-utils';


interface ContentProps {
    onFormStateChange: (newState: any) => void;
    formState?: any;
}

const hungerLevels = [
    { value: 0, label: '0 - Stuffed' },
    { value: 1, label: '1 - Overly Full' },
    { value: 2, label: '2 - Satiated' },
    { value: 3, label: '3 - Barely Satiated' },
    { value: 4, label: '4 - Not Hungry, Not Full' },
    { value: 5, label: '5 - Neutral' },
    { value: 6, label: '6 - Slightly Hungry' },
    { value: 7, label: '7 - Hungry' },
    { value: 8, label: '8 - Very Hungry' },
    { value: 9, label: '9 - Famished' },
    { value: 10, label: '10 - Starving' }
];

const HungerScaleDropdown = ({ value, onValueChange, label = "Hunger Level (0-10)" }: { value: number, onValueChange: (value: number) => void, label?: string }) => {
    return (
        <div className="space-y-1">
            <Label>{label}</Label>
            <Select value={String(value)} onValueChange={(v) => onValueChange(Number(v))}>
                <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                    {hungerLevels.map(i => <SelectItem key={i.value} value={String(i.value)}>{i.label}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
    );
};

const UPFBadge = ({ classification, reasoning, onClick }: { classification: 'green' | 'yellow' | 'red', reasoning?: string, onClick: () => void }) => {
    const config = {
        green: { label: 'Whole Food', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
        yellow: { label: 'Processed', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
        red: { label: 'UPF', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
    };
    const { label, className } = config[classification] || {};
    
    return (
        <button type="button" onClick={onClick} className={cn("inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)}>
            {label}
        </button>
    );
};


const getNutrientsForServing = (food: Food, quantity: number, unitLabel: string) => {
    const servingOption = food.servingOptions.find(opt => opt.label === unitLabel);
    // Fallback to 100g if the selected serving is somehow not found
    const servingGrams = servingOption ? servingOption.grams : 100;
    // The ratio to scale the per-100g nutrient values
    const ratio = (servingGrams / 100) * quantity;
    
    const calculatedNutrients: Record<string, { value: number; unit: string; }> = {};
    for (const key in food.nutrients) {
        calculatedNutrients[key] = {
            value: (food.nutrients[key]?.value || 0) * ratio,
            unit: food.nutrients[key]?.unit || '',
        }
    }
    return calculatedNutrients;
};


const FoodDetailView = ({ food, upf, onAdd, onBack, onReasoningClick }: { food: Food, upf: DetectUpfOutput | null, onAdd: (food: Food, quantity: number, unit: string) => void, onBack: () => void, onReasoningClick: (reason: string) => void }) => {
    const { userProfile } = useAuth();
    const units = userProfile?.onboarding?.units || 'imperial';
    const defaultServing = getBestDefaultServing(food);
    const [quantity, setQuantity] = useState(1);
    const [selectedServing, setSelectedServing] = useState(defaultServing.label);

    const nutrientData = useMemo(() => {
        return getNutrientsForServing(food, quantity, selectedServing);
    }, [food, quantity, selectedServing]);

    const calories = nutrientData['Energy']?.value || 0;
    const protein = nutrientData['Protein']?.value || 0;
    const fat = nutrientData['Total lipid (fat)']?.value || 0;
    const carbs = nutrientData['Carbohydrate, by difference']?.value || 0;
    const fiber = nutrientData['Fiber, total dietary']?.value || 0;

    return (
        <motion.div key="food-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-1 space-y-2">
             <div className="flex justify-between items-center">
                <div className="text-xs font-semibold flex items-center gap-2">
                    {food.description}
                    {food.attributes?.isGlutenFree && <Badge variant="outline" className="text-xs p-0.5 px-1.5">GF</Badge>}
                </div>
                {upf && <UPFBadge classification={upf.classification} reasoning={upf.reasoning} onClick={() => onReasoningClick(upf.reasoning)} />}
             </div>
             <p className="text-[10px] text-muted-foreground -mt-2">{food.brandOwner || 'Generic'}</p>

              <div className="grid grid-cols-5 gap-1 text-center p-1 rounded-md bg-muted/50">
                 <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold">{calories.toFixed(0)}</span>
                    <span className="text-[9px] text-muted-foreground leading-none">kcal</span>
                </div>
                 <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold">{protein.toFixed(0)}g</span>
                    <span className="text-[9px] text-muted-foreground leading-none">Protein</span>
                </div>
                 <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold">{fat.toFixed(0)}g</span>
                    <span className="text-[9px] text-muted-foreground leading-none">Fat</span>
                </div>
                 <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold">{carbs.toFixed(0)}g</span>
                    <span className="text-[9px] text-muted-foreground leading-none">Carbs</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold">{fiber.toFixed(1)}g</span>
                    <span className="text-[9px] text-muted-foreground leading-none">Fiber</span>
                </div>
            </div>

             <div className="flex items-center gap-2">
                <AppNumberInput value={quantity} onChange={(val) => setQuantity(val === '' ? 1 : val)} className="h-8 w-16 text-xs" placeholder="Qty" min={0.1} step={0.25} />
                <Select value={selectedServing} onValueChange={setSelectedServing}>
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Serving" /></SelectTrigger>
                    <SelectContent>
                        {food.servingOptions.map((opt) => (<SelectItem key={opt.label} value={opt.label}>{opt.label}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
             <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onBack} className="text-xs h-8 flex-1">Back to Results</Button>
                <Button size="sm" className="w-full h-8 flex-1" onClick={() => onAdd(food, quantity, selectedServing)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add to Meal
                </Button>
             </div>
        </motion.div>
    )
}


const MealSummary = ({ items, onRemove, onReasoningClick }: { items: any[], onRemove: (index: number) => void, onReasoningClick: (reason: string) => void }) => {
    
    const { totalCalories, totalProtein, totalFat, totalCarbs, totalFiber, averageUpfScore } = useMemo(() => {
        let totalCalories = 0, totalProtein = 0, totalFat = 0, totalCarbs = 0, totalFiber = 0, totalUpfScore = 0, upfItemCount = 0;

        items.forEach(item => {
            const nutrients = getNutrientsForServing(item.food, item.quantity, item.unit);
            totalCalories += nutrients['Energy']?.value || 0;
            totalProtein += nutrients['Protein']?.value || 0;
            totalFat += nutrients['Total lipid (fat)']?.value || 0;
            totalCarbs += nutrients['Carbohydrate, by difference']?.value || 0;
            totalFiber += nutrients['Fiber, total dietary']?.value || 0;
            
            if(item.upf && typeof item.upf.score === 'number') {
                totalUpfScore += item.upf.score;
                upfItemCount++;
            }
        });
        const averageUpfScore = upfItemCount > 0 ? totalUpfScore / upfItemCount : 0;
        return { totalCalories, totalProtein, totalFat, totalCarbs, totalFiber, averageUpfScore };
    }, [items]);
    
    if (items.length === 0) return null;

    return (
        <div className="space-y-2">
             <div className="grid grid-cols-6 gap-1 text-center p-2 rounded-lg bg-muted/50">
                <div className="flex flex-col items-center">
                    <UtensilsCrossed className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-bold">{totalCalories.toFixed(0)}</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">kcal</span>
                </div>
                 <div className="flex flex-col items-center">
                    <Beef className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-bold">{totalProtein.toFixed(0)}g</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">Protein</span>
                </div>
                <div className="flex flex-col items-center">
                    <Brain className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-bold">{totalFat.toFixed(0)}g</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">Fat</span>
                </div>
                <div className="flex flex-col items-center">
                    <Wheat className="h-4 w-4 text-orange-400" />
                    <span className="text-sm font-bold">{totalCarbs.toFixed(0)}g</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">Carbs</span>
                </div>
                <div className="flex flex-col items-center">
                    <Sprout className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-bold">{totalFiber.toFixed(1)}g</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">Fiber</span>
                </div>
                 <div className="flex flex-col items-center">
                    <ShieldAlert className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-bold">{averageUpfScore.toFixed(0)}%</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">UPF</span>
                </div>
            </div>
             <div className="space-y-1">
                {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs p-1 rounded-md bg-background/50">
                        <div className="flex-1">
                            <div className="font-semibold flex items-center gap-2">
                                {item.food.description}
                                {item.food.attributes?.isGlutenFree && <Badge variant="outline" className="text-xs p-0.5 px-1.5">GF</Badge>}
                            </div>
                            <p className="text-muted-foreground">{item.quantity} x {item.unit}</p>
                        </div>
                        {item.upf && <UPFBadge classification={item.upf.classification} reasoning={item.upf.reasoning} onClick={() => onReasoningClick(item.upf.reasoning)} />}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemove(index)}>
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}

export const NutritionContent = ({ onFormStateChange, formState }: ContentProps) => {
    const { toast } = useToast();
    const { userProfile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<EnrichedFoodSearchOutput | null>(null);
    const [selectedFood, setSelectedFood] = useState<EnrichedFoodItem | null>(null);
    const [upfReasoning, setUpfReasoning] = useState<string | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const {
        mealType = 'snack',
        hungerBefore = 5,
        mealItems = []
    } = formState?.log || {};

    const handleFieldChange = (field: string, value: any) => {
        onFormStateChange({ ...formState, log: { ...(formState?.log || {}), [field]: value } });
    };
    
    const handleSearch = useCallback(async () => {
        if (!searchTerm.trim()) return;
        setIsLoading(true);
        setSearchResults(null);
        setSelectedFood(null);
        try {
            const units = userProfile?.onboarding?.units || 'imperial';
            const results = await searchAndAnalyzeFoods({ query: searchTerm, units });
            setSearchResults(results);
            if (!results || results.length === 0) {
                toast({ variant: 'default', title: 'No Results', description: 'No foods with nutritional data found for your search.' });
            }
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Search Failed', description: error.message === 'API_KEY_IS_THE_ISSUE' ? 'USDA API key is missing. Please configure it.' : 'Could not perform search.' });
        } finally {
            setIsLoading(false);
        }
    }, [searchTerm, toast, userProfile]);

    const handleAddMealItem = (food: Food, quantity: number, unit: string) => {
        const enrichedFood = searchResults?.find(r => r.food.fdcId === food.fdcId);

        if (!enrichedFood) return;
        
        const newItem = {
            ...enrichedFood,
            quantity,
            unit,
        };
        const newMealItems = [...mealItems, newItem];
        handleFieldChange('mealItems', newMealItems);
        
        setSelectedFood(null);
        setSearchTerm('');
        setSearchResults(null);
        setIsSearchOpen(false);
    };

    const handleRemoveMealItem = (index: number) => {
        const newMealItems = mealItems.filter((_: any, i: number) => i !== index);
        handleFieldChange('mealItems', newMealItems);
    };

    useEffect(() => {
        const mealSummary = mealItems.reduce((summary: any, item: any) => {
            const itemNutrients = getNutrientsForServing(item.food, item.quantity, item.unit);
            for (const key in itemNutrients) {
                if (!summary.nutrients[key]) {
                    summary.nutrients[key] = { value: 0, unit: itemNutrients[key].unit };
                }
                summary.nutrients[key].value += itemNutrients[key].value;
            }
            return summary;
        }, { nutrients: {} });
        
        let totalScore = 0;
        let countedItems = 0;
        mealItems.forEach((item: any) => {
            const upfInfo = item.upf;
            if (upfInfo && typeof upfInfo.score === 'number') {
                totalScore += upfInfo.score;
                countedItems++;
            }
        });
        
        mealSummary.upf = { score: countedItems > 0 ? totalScore / countedItems : 0 };
        mealSummary.allNutrients = mealSummary.nutrients; // Keep a full copy for detailed views
        delete mealSummary.nutrients;


        onFormStateChange((prev: any) => ({
            ...prev,
            log: {
                ...(prev.log || {}),
                summary: mealSummary,
                 items: mealItems.map((item: any) => ({
                    ...item.food,
                    quantity: item.quantity,
                    unit: item.unit,
                    upf: item.upf
                }))
            }
        }));

    }, [mealItems, onFormStateChange]);
    
    const FoodResults = ({ foods }: { foods: EnrichedFoodItem[] }) => {
        if (!foods || foods.length === 0) return null;
        
        return (
             <div className="space-y-1">
                {foods.map((result) => {
                    const food = result.food;
                    const defaultServing = getBestDefaultServing(food);
                    if (!defaultServing) return null;
    
                    const energyPer100g = food.nutrients['Energy']?.value || 0;
                    const calories = (energyPer100g / 100) * defaultServing.grams;
                    
                    return (
                    <button
                        type="button"
                        key={food.fdcId}
                        onClick={() => setSelectedFood(result)}
                        className="w-full text-left p-1 rounded-md hover:bg-white/5 flex justify-between items-center"
                    >
                        <div>
                            <div className="text-xs font-semibold flex items-center gap-2">
                                {food.description}
                                {food.attributes?.isGlutenFree && <Badge variant="outline" className="text-xs p-0.5 px-1.5">GF</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">{food.brandOwner || 'Generic'}</p>
                        </div>
                        <div className="text-right flex-shrink-0 pl-2">
                            <p className="text-xs font-bold text-amber-400">{calories.toFixed(0)} kcal</p>
                            <p className="text-[10px] text-muted-foreground">per {defaultServing.label}</p>
                        </div>
                    </button>
                )})}
            </div>
        )
    }

    return (
        <>
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <Label>Meal Type</Label>
                        <Select value={mealType} onValueChange={(v) => handleFieldChange('mealType', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="breakfast">Breakfast</SelectItem>
                                <SelectItem value="lunch">Lunch</SelectItem>
                                <SelectItem value="dinner">Dinner</SelectItem>
                                <SelectItem value="snack">Snack</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <HungerScaleDropdown value={hungerBefore} onValueChange={(v) => handleFieldChange('hungerBefore', v)} label="Hunger Before" />
                </div>
                
                <MealSummary items={mealItems} onRemove={handleRemoveMealItem} onReasoningClick={(reason) => setUpfReasoning(reason)} />
                
                <Button variant="outline" className="w-full" onClick={() => setIsSearchOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Food to Meal
                </Button>
            </div>

             <BaseModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                title="Search & Add Food"
                description="For best results, include brand name or preparation (e.g., 'roasted')."
                className="max-w-md h-[70vh]"
            >
                <div className="h-full flex flex-col space-y-2">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Input
                            placeholder="e.g., 'Chobani yogurt' or 'large egg'"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button size="icon" onClick={handleSearch} disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ScrollArea className="h-full pr-3 -mr-3">
                            <AnimatePresence mode="wait">
                            {selectedFood ? (
                                    <FoodDetailView 
                                        key={selectedFood.food.fdcId}
                                        food={selectedFood.food}
                                        upf={selectedFood.upf}
                                        onAdd={handleAddMealItem}
                                        onBack={() => setSelectedFood(null)}
                                        onReasoningClick={(reason) => setUpfReasoning(reason)}
                                    />
                            ) : (
                                <motion.div key="search-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    {isLoading ? (
                                        <div className="flex justify-center items-center h-full">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        </div>
                                    ) : searchResults && <FoodResults foods={searchResults} />}
                                </motion.div>
                            )}
                            </AnimatePresence>
                        </ScrollArea>
                    </div>
                </div>
            </BaseModal>

            {upfReasoning && (
                <BaseModal 
                    isOpen={!!upfReasoning}
                    onClose={() => setUpfReasoning(null)}
                    title="UPF Reasoning"
                    description="Here's why this food received its rating:"
                    className="max-w-md"
                >
                    <p className="text-sm">{upfReasoning}</p>
                    <div className="pt-4 flex justify-end">
                        <Button onClick={() => setUpfReasoning(null)}>Close</Button>
                    </div>
                </BaseModal>
            )}
        </>
    );
};
