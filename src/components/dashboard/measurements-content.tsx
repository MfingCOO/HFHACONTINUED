'use client';

import * as React from 'react';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ClientProfile } from '@/types';
import { AppNumberInput } from '../ui/number-input';

interface ContentProps {
    onFormStateChange: (newState: any) => void;
    formState?: any;
    clientProfile: ClientProfile | null;
}

export const MeasurementsContent = ({ onFormStateChange, formState, clientProfile }: Omit<ContentProps, 'pillar'|'entryDate'>) => {
    const {
        weight = '',
        waist = '',
        notes = ''
    } = formState?.log || {};

    const handleFieldChange = (field: string, value: any) => {
        onFormStateChange({ ...formState, log: { ...formState.log, [field]: value } });
    };

    const units = clientProfile?.onboarding?.units === 'metric' 
        ? { weight: 'kg', waist: 'cm' } 
        : { weight: 'lbs', waist: 'in' };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Weight</Label>
                <div className="flex items-center gap-2">
                    <AppNumberInput 
                        value={weight}
                        onChange={(value) => handleFieldChange('weight', value === '' ? '' : value)}
                        placeholder="e.g., 150" 
                        className="flex-1" 
                    />
                    <span className="text-muted-foreground">{units.weight}</span>
                </div>
            </div>
             <div className="space-y-2">
                <Label>Waist Circumference</Label>
                <div className="flex items-center gap-2">
                    <AppNumberInput 
                        value={waist}
                        onChange={(value) => handleFieldChange('waist', value === '' ? '' : value)}
                        placeholder="e.g., 32" 
                        className="flex-1" 
                    />
                    <span className="text-muted-foreground">{units.waist}</span>
                </div>
            </div>
            <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                    value={notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    placeholder="Any notes about today's measurements..." 
                />
            </div>
        </div>
    );
}
