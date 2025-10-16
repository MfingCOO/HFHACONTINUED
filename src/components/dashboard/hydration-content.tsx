
'use client';

import * as React from 'react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { UpgradeModal } from '../modals/upgrade-modal';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Lock, PlusCircle, X } from 'lucide-react';
import { ClientProfile } from '@/types';
import { AppNumberInput } from '../ui/number-input';

interface ContentProps {
    onFormStateChange: (newState: any) => void;
    formState?: any;
    clientProfile: ClientProfile | null;
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

export const HydrationContent = ({ clientProfile, formState, onFormStateChange }: Omit<ContentProps, 'pillar' | 'entryDate' >) => {
    const { log = {}, settings = {} } = formState || {};
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const suggestedGoal = clientProfile?.suggestedHydrationGoal;

    const handleLogChange = (field: string, value: any) => {
        onFormStateChange({ ...formState, log: { ...log, [field]: value }});
    }
    const handleSettingsChange = (field: string, value: any) => {
        onFormStateChange({ ...formState, settings: { ...settings, [field]: value }});
    }

    const isRemindersLocked = clientProfile?.tier === 'free' || clientProfile?.tier === 'ad-free';

    const handleReminderToggle = (checked: boolean) => {
        if (isRemindersLocked) {
            setIsUpgradeModalOpen(true);
            return;
        }
        handleSettingsChange('remindersEnabled', checked);
        if (checked && (!formState.settings.reminderTimes || formState.settings.reminderTimes.length === 0)) {
             handleSettingsChange('reminderTimes', ['09:00', '12:00', '15:00']);
        }
        if (checked) {
            if (Notification.permission !== "granted") {
                 Notification.requestPermission();
            }
        }
    };
    
    const addReminderTime = () => handleSettingsChange('reminderTimes', [...(formState.settings.reminderTimes || []), '17:00']);
    const removeReminderTime = (index: number) => handleSettingsChange('reminderTimes', formState.settings.reminderTimes.filter((_: any, i: number) => i !== index));
    const updateReminderTime = (index: number, value: string) => {
        const newTimes = [...formState.settings.reminderTimes];
        newTimes[index] = value;
        handleSettingsChange('reminderTimes', newTimes);
    }
    
    return (
        <>
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>How much did you drink (oz)?</Label>
                <AppNumberInput
                    value={log.amount || ''}
                    onChange={value => handleLogChange('amount', value === '' ? 0 : value)}
                    placeholder="e.g. 16"
                />
                 <div className="grid grid-cols-4 gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => handleLogChange('amount', (log.amount || 0) + 8)}>+8oz</Button>
                    <Button variant="outline" size="sm" onClick={() => handleLogChange('amount', (log.amount || 0) + 12)}>+12oz</Button>
                    <Button variant="outline" size="sm" onClick={() => handleLogChange('amount', (log.amount || 0) + 16)}>+16oz</Button>
                    <Button variant="outline" size="sm" onClick={() => handleLogChange('amount', (log.amount || 0) + 20)}>+20oz</Button>
                </div>
            </div>
            <HungerScaleDropdown value={log.hunger || 5} onValueChange={(v) => handleLogChange('hunger', v)} />
            <div className="space-y-2">
                <Textarea value={log.notes || ''} onChange={(e) => handleLogChange('notes', e.target.value)} placeholder="Notes" />
            </div>

            <Separator />
            <h4 className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hydration Settings</h4>

             <div className="space-y-2">
                <Label>Daily Goal (oz)</Label>
                <AppNumberInput
                    value={settings.customGoal || ''}
                    onChange={value => handleSettingsChange('customGoal', value)}
                    placeholder={`Suggested: ${suggestedGoal} oz`}
                />
            </div>
             <div className="space-y-2">
                 <Label>Reminders</Label>
                 <div className={cn("flex flex-col gap-4 rounded-lg border p-3", isRemindersLocked ? "border-amber-500/50 bg-amber-500/10" : "border-border")}>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="reminders-switch" className="text-sm font-medium">
                               Enable Drink Reminders
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Get notifications to help you stay hydrated.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isRemindersLocked && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Lock className="h-4 w-4 text-amber-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Available on Basic tier and up.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <Switch
                            id="reminders-switch"
                            checked={settings.remindersEnabled}
                            onCheckedChange={handleReminderToggle}
                            disabled={isRemindersLocked}
                          />
                        </div>
                    </div>
                     {settings.remindersEnabled && !isRemindersLocked && (
                        <div className="space-y-3 pt-2 border-t border-border">
                            {(settings.reminderTimes || []).map((time: string, index: number) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input 
                                        type="time" 
                                        value={time} 
                                        onChange={e => updateReminderTime(index, e.target.value)} 
                                        className="flex-1"
                                    />
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeReminderTime(index)}>
                                        <X className="h-4 w-4"/>
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" className="w-full" onClick={addReminderTime}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Reminder
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
         <UpgradeModal
            isOpen={isUpgradeModalOpen}
            onClose={() => setIsUpgradeModalOpen(false)}
            requiredTier="basic"
            featureName="Hydration Reminders"
            reason="Build consistent hydration habits with gentle reminders."
        />
        </>
    );
};
