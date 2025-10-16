
'use client';

import * as React from 'react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon, Calendar as CalendarIcon } from 'lucide-react';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { Textarea } from '../ui/textarea';
import { AppNumberInput } from '../ui/number-input';

interface ContentProps {
    onFormStateChange: (newState: any) => void;
    formState?: any;
    entryDate: Date;
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

export const SleepContent = ({ onFormStateChange, formState, entryDate: dialogEntryDate }: Omit<ContentProps, 'pillar' | 'clientProfile'>) => {
    const {
        duration = 8,
        quality = 4,
        hunger = 3,
        wakingStress = 3,
        wakeUpDate: formWakeUpDate,
        wakeUpTime = "07:00",
        notes = ''
    } = formState?.log || {};

    const isMobile = useIsMobile();

    const handleFieldChange = (field: string, value: any) => {
        onFormStateChange({
            ...formState,
            log: { ...formState.log, [field]: value }
        });
    };

    const wakeUpDate = formWakeUpDate ? new Date(formWakeUpDate) : dialogEntryDate;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label>Wake Up Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(wakeUpDate, isMobile ? 'MM/dd/yy' : 'PPP')}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={wakeUpDate}
                                onSelect={(date) => handleFieldChange('wakeUpDate', date || new Date())}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="space-y-2">
                    <Label>Wake Up Time</Label>
                     <Input
                        type="time"
                        value={wakeUpTime}
                        onChange={e => handleFieldChange('wakeUpTime', e.target.value)}
                    />
                </div>
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Duration (hrs)</Label>
                    <AppNumberInput
                        value={duration}
                        onChange={(value) => handleFieldChange('duration', value === '' ? 0 : value)}
                        step="0.25"
                        placeholder="e.g., 8"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Quality (1-5)</Label>
                    <Select value={String(quality)} onValueChange={(v) => handleFieldChange('quality', Number(v))}>
                        <SelectTrigger><SelectValue placeholder="Select quality..." /></SelectTrigger>
                        <SelectContent>
                            {numberScale(1, 5).map(i => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <HungerScaleDropdown value={hunger} onValueChange={(v) => handleFieldChange('hunger', v)} label="Waking Hunger" />
                <div className="space-y-1">
                    <Label>Waking Stress (1-10)</Label>
                    <Select value={String(wakingStress)} onValueChange={(v) => handleFieldChange('wakingStress', Number(v))}>
                        <SelectTrigger><SelectValue placeholder="Select stress level..."/></SelectTrigger>
                        <SelectContent>
                            {numberScale(1, 10).map(i => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Night Time Routine Before Sleep</Label>
                <Textarea value={notes} onChange={(e) => handleFieldChange('notes', e.target.value)} placeholder="e.g., read a book, meditated, watched TV..." />
            </div>
        </div>
    )
}
