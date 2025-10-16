
'use client';

import * as React from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';

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


export const PlannerContent = ({ onFormStateChange, formState }: Omit<ContentProps, 'pillar' | 'entryDate' | 'clientProfile'>) => {
    const handleChange = (field: string, value: any) => {
        onFormStateChange({ ...formState, log: { ...formState.log, [field]: value } });
    };

    const {
        plannedIndulgence = '',
        occasion = '',
        preDayHydrationGoal = '',
        preDayMealPlan = '',
        postIndulgenceMeal = '',
    } = formState?.log || {};


    return (
        <div className="space-y-4">
            <h4 className="text-sm font-semibold text-center text-muted-foreground">The Indulgence</h4>
            <div className="space-y-2">
                <Input value={plannedIndulgence} onChange={(e) => handleChange('plannedIndulgence', e.target.value)} placeholder="Planned Indulgence" />
            </div>
             <div className="space-y-2">
                <Textarea value={occasion} onChange={(e) => handleChange('occasion', e.target.value)} placeholder="What was the occasion for the indulgence" />
            </div>
            
             <Separator />
            <h4 className="text-sm font-semibold text-center text-muted-foreground">The Preparation</h4>
             <div className="space-y-2">
                <Label>Pre-Indulgence Hydration Goal</Label>
                <Input value={preDayHydrationGoal} onChange={(e) => handleChange('preDayHydrationGoal', e.target.value)} placeholder="e.g., At least 64oz of water" />
            </div>
             <div className="space-y-2">
                <Label>Pre-Indulgence Meal Plan</Label>
                <Textarea value={preDayMealPlan} onChange={(e) => handleChange('preDayMealPlan', e.target.value)} placeholder="e.g., Protein-rich breakfast & a large salad for lunch to stabilize blood sugar." />
            </div>

             <Separator />
            <h4 className="text-sm font-semibold text-center text-muted-foreground">The Recovery</h4>
             <div className="space-y-2">
                 <Label>Post-Indulgence Meal Plan</Label>
                <Input value={postIndulgenceMeal} onChange={(e) => handleChange('postIndulgenceMeal', e.target.value)} placeholder="e.g., Steak salad" />
            </div>
        </div>
    );
}

