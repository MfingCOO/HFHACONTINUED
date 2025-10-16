
'use client';

import * as React from 'react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { X, Loader2, Trash2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format, startOfDay } from 'date-fns';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { saveDataAction, saveIndulgencePlanAction } from '@/services/firestore';
import { useAuth } from '../auth/auth-provider';
import type { ClientProfile, UserTier } from '@/types';
import { updateClientWthr } from '@/app/coach/clients/actions';
import { getTodaysContextualData } from '@/app/calendar/actions';
import { generateHolisticInsight, GenerateHolisticInsightOutput } from '@/ai/flows/generate-holistic-insight';
import { InsightResponseModal } from '../modals/insight-response-modal';
import { BaseModal } from '@/components/ui/base-modal';


// Import all the new pillar-specific components
import { NutritionContent } from './nutrition-content';
import { ActivityContent } from './activity-content';
import { SleepContent } from './sleep-content';
import { HydrationContent } from './hydration-content';
import { MeasurementsContent } from './measurements-content';
import { ProtocolContent } from './protocol-content';
import { PlannerContent } from './planner-content';
import { CravingsBingeContent } from './cravings-binge-content';
import { StressReliefContent } from './stress-relief-content';
import { useIsMobile } from '@/hooks/use-mobile';


interface Pillar {
    id: string;
    label: string;
    icon: LucideIcon;
    color: string;
    bgColor: string;
    borderColor: string;
    quotes?: string[];
    requiredTier: UserTier;
}

interface DataEntryDialogProps {
    open: boolean;
    onOpenChange: (wasSaved: boolean) => void;
    pillar: Pillar | null;
    initialData?: any | null;
    onDelete?: () => void;
    userId?: string; // For coaches editing client data
    clientProfile?: ClientProfile | null; // Receive client profile as a prop
}

const DateTimePicker = ({ date, setDate }: { date: Date, setDate: (date: Date) => void }) => {
    const isMobile = useIsMobile();

    const setTime = (timeValue: string) => {
        const [hours, minutes] = timeValue.split(':').map(Number);
        const newDate = new Date(date);
        newDate.setHours(hours);
        newDate.setMinutes(minutes);
        setDate(newDate);
    };

    const setDateFromInput = (dateValue: string) => {
        const newDate = new Date(dateValue);
        // When using input[type=date], the value is in YYYY-MM-DD format and is interpreted as UTC.
        // To prevent off-by-one day errors due to timezones, we need to account for the local timezone offset.
        const timezoneOffset = newDate.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(newDate.getTime() + timezoneOffset);

        const finalDate = new Date(date);
        finalDate.setFullYear(adjustedDate.getFullYear(), adjustedDate.getMonth(), adjustedDate.getDate());
        setDate(finalDate);
    }
    
    if (isMobile) {
        // Simplified mobile view, which is more reliant on native browser UI for date/time
        return (
             <div className="flex items-center justify-center gap-1">
                <Input 
                    type="date"
                    value={format(date, 'yyyy-MM-dd')}
                    onChange={e => setDateFromInput(e.target.value)}
                    className="w-auto h-8 p-1 text-xs border-input bg-transparent text-white"
                />
                 <div className="h-4 w-px bg-border" />
                <Input 
                    type="time" 
                    value={format(date, 'HH:mm')}
                    onChange={e => setTime(e.target.value)}
                    className="w-auto h-8 p-1 text-xs border-input bg-transparent text-white"
                />
            </div>
        )
    }
    
    return (
        <div className="flex items-center justify-center gap-1 text-xs text-white">
            <Popover>
                <PopoverTrigger asChild>
                    <div className="flex h-7 items-center justify-start gap-1 rounded-md border border-input bg-transparent px-2 text-left font-normal cursor-pointer">
                        <CalendarIcon className="h-3 w-3 text-white" />
                        <span>{format(date, 'MMM d')}</span>
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => setDate(d || new Date())}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
            <div className="h-4 w-px bg-border" />
            <div className="relative flex h-7 items-center justify-start gap-1 rounded-md border border-input bg-transparent px-2">
                <Clock className="h-3 w-3 text-white" />
                <Input 
                    type="time" 
                    value={format(date, 'HH:mm')}
                    onChange={e => setTime(e.target.value)}
                    className="h-full w-full appearance-none border-none bg-transparent p-0 focus:ring-0 focus-visible:ring-0"
                />
            </div>
        </div>
    )
}

export function DataEntryDialog({ 
    open, 
    onOpenChange, 
    pillar, 
    initialData, 
    onDelete, 
    userId,
    clientProfile: initialClientProfile,
}: DataEntryDialogProps) {
    const { toast } = useToast();
    const { user, userProfile: authUserProfile } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [entryDate, setEntryDate] = useState(new Date());
    const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
    const [isLoadingContent, setIsLoadingContent] = useState(true);
    const [formState, setFormState] = useState<any>({});
    
    const [insightResponse, setInsightResponse] = useState<GenerateHolisticInsightOutput | null>(null);
    const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);

    const currentUserId = userId || user?.uid;
    
    const onFormStateChange = useCallback((newState: any) => {
        setFormState(newState);
    }, []);
    
    const getInitialFormState = useCallback((pillarId: string, contextData: any, clientData: ClientProfile | null) => {
        const { lastNightSleep, todaysHydration } = contextData || {};
        switch (pillarId) {
            case 'hydration':
                 return { 
                    log: {
                        amount: initialData?.amount || 16,
                        hunger: initialData?.hunger || 5,
                        notes: initialData?.notes || '',
                    },
                    settings: {
                        customGoal: clientData?.hydrationSettings?.customGoal || '',
                        remindersEnabled: clientData?.hydrationSettings?.remindersEnabled || false,
                        reminderTimes: clientData?.hydrationSettings?.reminderTimes || [],
                    }
                 };
            case 'sleep':
                const initialWakeUp = initialData?.wakeUpDay ? new Date(initialData.wakeUpDay) : new Date();
                return {
                    log: {
                        duration: initialData?.duration || 8,
                        quality: initialData?.quality || 4,
                        hunger: initialData?.hunger || 3,
                        wakingStress: initialData?.wakingStress || 3,
                        wakeUpDate: initialWakeUp,
                        wakeUpTime: initialData?.wakeUpTime || format(initialWakeUp, "HH:mm"),
                        notes: initialData?.notes || '',
                    }
                };
            case 'activity':
                return {
                     log: {
                        category: initialData?.category || 'cardio',
                        activityType: initialData?.activityType || '',
                        otherActivityType: initialData?.activityType === 'Other' ? initialData.activityType : '',
                        duration: initialData?.duration || 30,
                        intensity: initialData?.intensity || 'moderate',
                        hungerBefore: initialData?.hungerBefore || 4,
                        hungerAfter: initialData?.hungerAfter || 6,
                        notes: initialData?.notes || '',
                    }
                }
            case 'measurements':
                 return {
                    log: {
                        weight: initialData?.weight || '',
                        waist: initialData?.waist || '',
                        notes: initialData?.notes || '',
                    }
                }
             case 'protocol':
                return {
                    log: {
                        mealDescription: initialData?.mealDescription || '',
                        preMealHunger: initialData?.preMealHunger || 5,
                        preMealStress: initialData?.preMealStress || 3,
                        sleepLastNight: initialData?.sleepLastNight ?? lastNightSleep ?? 8,
                        hydrationToday: initialData?.hydrationToday ?? todaysHydration ?? 64,
                        postMealHunger: initialData?.postMealHunger || 2,
                        percentageEaten: initialData?.percentageEaten || 100,
                        notes: initialData?.notes || '',
                    }
                }
            case 'planner':
                return {
                     log: {
                        plannedIndulgence: initialData?.plannedIndulgence || '',
                        occasion: initialData?.occasion || '',
                        preDayHydrationGoal: initialData?.preDayHydrationGoal || '',
                        preDayMealPlan: initialData?.preDayMealPlan || '',
                        postIndulgenceMeal: initialData?.postIndulgenceMeal || '',
                        initialHunger: initialData?.initialHunger || 5,
                    }
                }
            case 'stress':
                return {
                    activeTab: initialData?.type || 'event',
                    manualSleep: initialData?.sleepLastNight ?? (lastNightSleep ?? ''),
                    manualHydration: initialData?.hydrationToday ?? (todaysHydration ?? ''),
                    stressLevel: initialData?.stressLevel || 5,
                    trigger: initialData?.trigger || '',
                    strategy: initialData?.strategy || '',
                    stressLevelBefore: initialData?.stressLevelBefore || 5,
                    stressLevelAfter: initialData?.stressLevelAfter || 3,
                    hungerLevel: initialData?.hungerLevel || 5,
                    notes: initialData?.notes || '',
                }
            case 'cravings':
                return {
                     activeTab: initialData?.type || "craving",
                     severity: initialData?.severity || 3,
                     stress: initialData?.stress || 5,
                     hunger: initialData?.hunger || 7,
                     manualSleep: initialData?.sleepLastNight ?? (lastNightSleep ?? ''),
                     manualHydration: initialData?.hydrationToday ?? (todaysHydration ?? ''),
                     craving: initialData?.craving || '',
                     outcome: initialData?.outcome || '',
                     bingeFood: initialData?.bingeFood || '',
                     triggers: initialData?.triggers || '',
                }
            case 'nutrition':
                return {
                    log: {
                        mealType: initialData?.mealType || 'snack',
                        hungerBefore: initialData?.hungerBefore || 5,
                        mealItems: initialData?.items?.map((item: any) => ({ food: item, upf: item.upf, quantity: item.quantity || 1, unit: item.unit || 'serving' })) || [],
                        portionQuantity: 1,
                        portionUnit: 'serving',
                    }
                }
            default:
                return {};
        }
    }, [initialData]);


    useEffect(() => {
        if (open && pillar) {
            setIsLoadingContent(true);
            const effectiveProfile = initialClientProfile || (authUserProfile as ClientProfile | null);
            setClientProfile(effectiveProfile);
            
            getTodaysContextualData(currentUserId || '').then(contextData => {
                 setFormState(getInitialFormState(pillar.id, contextData, effectiveProfile));
                 setIsLoadingContent(false);
            });
        }
    }, [open, pillar, initialClientProfile, authUserProfile, getInitialFormState, currentUserId]);


    useEffect(() => {
        if (!open || !pillar) return;
        if (initialData?.entryDate) {
            setEntryDate(new Date(initialData.entryDate));
        } else {
            setEntryDate(new Date());
        }
    }, [open, pillar, initialData]);

    const randomQuote = useMemo(() => {
        if (!pillar || !pillar.quotes || pillar.quotes.length === 0) {
            return null;
        }
        const randomIndex = Math.floor(Math.random() * pillar.quotes.length);
        return pillar.quotes[randomIndex];
    }, [pillar]);


    if (!pillar) return null;
    
    const handleSave = async () => {
        setIsSaving(true);
        if (!currentUserId) {
            toast({ variant: 'destructive', title: 'Authentication Error', description: `Could not verify your user session.` });
            setIsSaving(false);
            return;
        }

        let dataToSave: any = { ...formState };
        let finalLogData = { ...(dataToSave.log || {}) };

        // Handle date setting based on pillar type
        if (pillar.id === 'sleep') {
            const wakeUpDate = finalLogData.wakeUpDate || entryDate;
            const [wakeH, wakeM] = (finalLogData.wakeUpTime || "07:00").split(':').map(Number);
            const finalWakeUpDateTime = new Date(wakeUpDate);
            finalWakeUpDateTime.setHours(wakeH, wakeM, 0, 0);

            finalLogData.wakeUpDay = startOfDay(finalWakeUpDateTime);
            finalLogData.entryDate = new Date(finalWakeUpDateTime.getTime() - (finalLogData.duration || 0) * 60 * 60 * 1000);
        } else if (pillar.id !== 'planner') {
            finalLogData.entryDate = entryDate;
        }
        
        if (pillar.id === 'stress') {
            const commonData = {
                type: formState.activeTab,
                hungerLevel: formState.hungerLevel,
                notes: formState.notes,
                sleepLastNight: formState.manualSleep === '' ? null : Number(formState.manualSleep),
                hydrationToday: formState.manualHydration === '' ? null : Number(formState.manualHydration),
                entryDate: entryDate,
            };
            if (formState.activeTab === 'event') finalLogData = { ...commonData, stressLevel: formState.stressLevel, trigger: formState.trigger };
            else finalLogData = { ...commonData, strategy: formState.strategy, stressLevelBefore: formState.stressLevelBefore, stressLevelAfter: formState.stressLevelAfter };
        }
        if (pillar.id === 'cravings') {
             const commonData = {
                type: formState.activeTab,
                hunger: formState.hunger,
                stress: formState.stress,
                sleepLastNight: formState.manualSleep === '' ? null : Number(formState.manualSleep),
                hydrationToday: formState.manualHydration === '' ? null : Number(formState.manualHydration),
                triggers: formState.triggers,
                entryDate: entryDate,
            };
            if (formState.activeTab === 'craving') finalLogData = { ...commonData, severity: formState.severity, craving: formState.craving, outcome: formState.outcome };
            else finalLogData = { ...commonData, bingeFood: formState.bingeFood, outcome: formState.outcome };
        }
        if (pillar.id === 'protocol') finalLogData = { ...finalLogData, entryDate };

        if (pillar.id === 'planner') {
            const planData = {
                ...finalLogData,
                indulgenceDate: entryDate,
                status: 'planned'
            };
            const result = await saveIndulgencePlanAction(planData, currentUserId, initialData?.id);
            if (result.success) {
                toast({ title: 'Plan Saved!', description: 'Your indulgence plan has been saved.' });
                onOpenChange(true); // pass true to indicate save
            } else {
                toast({ variant: 'destructive', title: 'Error Saving Plan', description: result.error || 'Please try again.' });
            }
            setIsSaving(false);
            return;
        }

        // Final payload cleaning and validation
        if (pillar.id === 'measurements') {
            const measurementLog: any = { entryDate: finalLogData.entryDate };
            // Proactively filter out zero or empty values before saving
            if (finalLogData.weight && Number(finalLogData.weight) > 0) measurementLog.weight = Number(finalLogData.weight);
            if (finalLogData.waist && Number(finalLogData.waist) > 0) measurementLog.waist = Number(finalLogData.waist);
            if (finalLogData.notes) measurementLog.notes = finalLogData.notes;
            dataToSave = { log: measurementLog };
        } else {
            dataToSave.log = finalLogData;
        }
        
        const hasLogData = dataToSave.log && Object.values(dataToSave.log).some(value => {
            if (typeof value === 'number') return value > 0;
            return value !== undefined && value !== '' && value !== null;
        });

        if (!hasLogData && !dataToSave.settings) {
            toast({ title: 'No Data Entered', description: `Please enter a value to save.` });
            setIsSaving(false);
            return;
        }

        try {
            const result = await saveDataAction(pillar.id, dataToSave, currentUserId, initialData?.id);
            if (result.success) {
                toast({ title: `Entry ${initialData ? 'Updated' : 'Saved'}!`, description: `${pillar.label} data has been successfully saved.`});
                
                // If a waist measurement was saved, update the client's summary WtHR
                if (pillar.id === 'measurements' && dataToSave.log?.waist > 0 && currentUserId) {
                    await updateClientWthr(currentUserId, dataToSave.log.waist);
                }

                // If a significant event is logged, call the holistic insight generator.
                if (pillar.id === 'cravings' || (pillar.id === 'stress' && dataToSave.log?.type === 'event')) {
                    const insightResult = await generateHolisticInsight({
                        userId: currentUserId,
                        periodInDays: 3,
                        triggeringEvent: JSON.stringify(dataToSave.log),
                    });
                    setInsightResponse(insightResult as any);
                    setIsInsightModalOpen(true);
                } else {
                    onOpenChange(true); // Indicate save was successful
                }

            } else {
                throw new Error(result.error?.toString() || "Failed to save data.");
            }
        } catch (error: any) {
            console.error("Error saving data:", error);
            toast({ variant: 'destructive', title: 'Error Saving Entry', description: `Could not save. Reason: ${error.message || 'Please try again.'}`});
        } finally {
            setIsSaving(false);
        }
    };
    
    // Map pillar IDs to their respective components
    const contentMap: Record<string, React.FC<any>> = {
        'nutrition': NutritionContent,
        'activity': ActivityContent,
        'sleep': SleepContent,
        'stress': StressReliefContent,
        'hydration': HydrationContent,
        'protocol': ProtocolContent,
        'planner': PlannerContent,
        'cravings': CravingsBingeContent,
        'measurements': MeasurementsContent,
    };

    const CurrentContent = contentMap[pillar.id];
    const isLongForm = ['nutrition', 'hydration', 'protocol', 'planner', 'cravings', 'stress'].includes(pillar.id);

    const dialogTitle = `${initialData ? 'Edit' : 'Log'} ${pillar.label}`;
    const dialogDescription = randomQuote || undefined;

    const dialogFooter = (
        <div className="flex items-center gap-2 w-full">
            {initialData && onDelete && (
                <Button onClick={onDelete} variant="destructive" size="sm" className="flex-shrink-0"><Trash2 className="w-4 h-4 mr-2" />Delete</Button>
            )}
            <div className="flex-1" />
            <Button onClick={() => onOpenChange(false)} variant="outline" size="sm" className="flex-shrink-0">Dismiss</Button>
            <Button onClick={handleSave} size="sm" className="flex-shrink-0 text-white bg-green-500 hover:bg-green-600" disabled={isSaving || isLoadingContent}>
                {(isSaving || isLoadingContent) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {initialData ? 'Update Entry' : 'Save Entry'}
            </Button>
        </div>
    );

    return (
        <>
        <BaseModal
            isOpen={open}
            onClose={() => onOpenChange(false)}
            title={dialogTitle}
            description={dialogDescription}
            className={cn("sm:max-w-lg", isLongForm ? 'h-[90dvh]' : 'h-auto')}
            footer={dialogFooter}
        >
             <div className="space-y-1">
                {pillar.id !== 'sleep' && pillar.id !== 'planner' && (
                    <div className="flex-shrink-0 flex justify-center py-1">
                        <DateTimePicker date={entryDate} setDate={setEntryDate} />
                    </div>
                )}
                {pillar.id === 'planner' && (
                    <div className="flex-shrink-0 flex justify-center py-1">
                        <Label className="text-xs mr-2">Date of Indulgence</Label>
                        <DateTimePicker date={entryDate} setDate={setEntryDate} />
                    </div>
                )}
                {isLoadingContent ? (
                    <div className="flex-1 flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                ) : CurrentContent ? (
                    <CurrentContent
                        pillar={pillar}
                        entryDate={entryDate}
                        initialData={initialData}
                        clientProfile={clientProfile}
                        formState={formState}
                        onFormStateChange={onFormStateChange}
                        userId={currentUserId}
                    />
                ) : (
                    <div className="text-center p-8">This form is under construction.</div>
                )}
            </div>
        </BaseModal>

        {insightResponse && (
            <InsightResponseModal
                isOpen={isInsightModalOpen}
                onClose={() => {
                    setIsInsightModalOpen(false);
                    setInsightResponse(null);
                    onOpenChange(true); // Indicate save was successful
                }}
                insight={insightResponse}
            />
        )}
        </>
    );
}
