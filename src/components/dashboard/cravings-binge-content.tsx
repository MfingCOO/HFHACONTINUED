'use client';

import * as React from 'react';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { AppNumberInput } from '../ui/number-input';

interface ContentProps {
    onFormStateChange: (newState: any) => void;
    formState?: any;
}

const numberScale = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);

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


export const CravingsBingeContent = (props: Omit<ContentProps, 'pillar' | 'entryDate' | 'clientProfile'>) => {
    const { formState, onFormStateChange } = props;
    const { 
        activeTab = "craving",
        severity = 3,
        stress = 5,
        hunger = 7,
        manualSleep = '',
        manualHydration = '',
        craving = '',
        outcome = '',
        bingeFood = '',
        triggers = ''
    } = formState || {};

    const handleChange = (field: string, value: any) => {
        onFormStateChange({ ...formState, [field]: value });
    };

    const sharedFields = (
         <div className="space-y-3 pt-3">
             <div className="grid grid-cols-2 gap-4">
                <HungerScaleDropdown value={hunger} onValueChange={(v) => handleChange('hunger', v)} />
                <div className="space-y-1">
                    <Label>Stress Level (1-10)</Label>
                    <Select value={String(stress)} onValueChange={(v) => handleChange('stress', Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{numberScale(1, 10).map(i => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label>Sleep Last Night (hrs)</Label>
                    <AppNumberInput value={manualSleep} onChange={v => handleChange('manualSleep', v)} placeholder={"e.g., 8"} />
                </div>
                <div className="space-y-1">
                    <Label>Hydration Today (oz)</Label>
                    <AppNumberInput value={manualHydration} onChange={v => handleChange('manualHydration', v)} placeholder={"e.g., 64"} />
                </div>
            </div>
             <div className="space-y-1">
                <Textarea value={triggers} onChange={(e) => handleChange('triggers', e.target.value)} placeholder="Suspected Triggers (e.g., boredom, argument...)" />
            </div>
         </div>
    )

    return (
        <Tabs value={activeTab} onValueChange={(v) => handleChange('activeTab', v)}>
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="craving">Log a Craving</TabsTrigger>
                <TabsTrigger value="binge">Log a Binge</TabsTrigger>
            </TabsList>
            <TabsContent value="craving" className="space-y-3 p-1 pt-4">
                 <div className="space-y-1">
                    <Textarea value={craving} onChange={(e) => handleChange('craving', e.target.value)} placeholder="What are you craving?" />
                </div>
                 <div className="space-y-1">
                    <Label>Craving Severity (1-5)</Label>
                    <Select value={String(severity)} onValueChange={(v) => handleChange('severity', Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{numberScale(1, 5).map(i => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                 <div className="space-y-1">
                    <Textarea value={outcome} onChange={(e) => handleChange('outcome', e.target.value)} placeholder="Outcome (e.g., I had a healthy alternative...)" />
                </div>
                {sharedFields}
            </TabsContent>
            <TabsContent value="binge" className="space-y-3 p-1 pt-4">
                 <div className="space-y-1">
                    <Textarea value={bingeFood} onChange={(e) => handleChange('bingeFood', e.target.value)} placeholder="What did you binge on? (List foods and quantities...)" />
                </div>
                <div className="space-y-1">
                    <Textarea value={outcome} onChange={(e) => handleChange('outcome', e.target.value)} placeholder="Outcome & Next Step (e.g., I stopped and drank water...)" />
                </div>
                 {sharedFields}
            </TabsContent>
        </Tabs>
    );
};
