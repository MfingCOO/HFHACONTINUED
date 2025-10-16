
'use client';

import * as React from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Textarea } from '../ui/textarea';

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

export const StressReliefContent = ({ formState, onFormStateChange }: Omit<ContentProps, 'pillar' | 'entryDate' | 'clientProfile'>) => {
    const handleChange = (field: string, value: any) => {
        onFormStateChange({ ...formState, [field]: value });
    };
    
    const {
        activeTab = 'event',
        manualSleep = '',
        manualHydration = '',
        stressLevel = 5,
        trigger = '',
        strategy = '',
        stressLevelBefore = 5,
        stressLevelAfter = 3,
        hungerLevel = 5,
        notes = '',
    } = formState || {};

    const sharedFields = (
        <div className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label>Sleep Last Night (hrs)</Label>
                    <Input type="number" value={manualSleep} onChange={e => handleChange('manualSleep', e.target.value)} placeholder={"e.g., 8"} />
                </div>
                <div className="space-y-1">
                    <Label>Hydration Today (oz)</Label>
                    <Input type="number" value={manualHydration} onChange={e => handleChange('manualHydration', e.target.value)} placeholder={"e.g., 64"} />
                </div>
            </div>
             <div className="space-y-1">
                <Textarea value={notes} onChange={(e) => handleChange('notes', e.target.value)} placeholder="Notes" />
            </div>
        </div>
    );

    return (
        <Tabs value={activeTab} onValueChange={(v) => handleChange('activeTab', v)}>
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="event">Log Stress Event</TabsTrigger>
                <TabsTrigger value="relief">Log Stress Relief</TabsTrigger>
            </TabsList>
            <TabsContent value="event" className="space-y-3 p-1 pt-4">
                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <Label>Stress Level (1-10)</Label>
                        <Select value={String(stressLevel)} onValueChange={(v) => handleChange('stressLevel', Number(v))}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                {numberScale(1, 10).map(i => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <HungerScaleDropdown value={hungerLevel} onValueChange={(v) => handleChange('hungerLevel', v)} />
                </div>
                <Textarea value={trigger} onChange={(e) => handleChange('trigger', e.target.value)} placeholder="Trigger" />
                {sharedFields}
            </TabsContent>
            <TabsContent value="relief" className="space-y-3 p-1 pt-4">
                <div className="space-y-1">
                    <Label>Relief Strategy</Label>
                    <Input value={strategy} onChange={(e) => handleChange('strategy', e.target.value)} placeholder="e.g., meditation, walk, hobby" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label>Stress Before</Label>
                        <Select value={String(stressLevelBefore)} onValueChange={(v) => handleChange('stressLevelBefore', Number(v))}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                {numberScale(1, 10).map(i => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label>Stress After</Label>
                        <Select value={String(stressLevelAfter)} onValueChange={(v) => handleChange('stressLevelAfter', Number(v))}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                {numberScale(1, 10).map(i => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                {sharedFields}
            </TabsContent>
        </Tabs>
    );
};
