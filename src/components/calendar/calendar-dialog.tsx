
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ClientProfile, NutritionalGoals } from '@/types';
import { DayView } from './day-view';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { getCalendarDataForDay } from '@/app/calendar/actions';
import { UtensilsCrossed, Droplet, Moon, Flame, ShieldAlert, ClipboardList, X, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { BaseModal } from '../ui/base-modal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Progress } from '../ui/progress';
import { rda } from '@/lib/rda';
import { getClientByIdAction } from '@/app/coach/clients/actions';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { SettingsDialog } from '../settings/SettingsDialog';
import { useDashboardActions } from '@/contexts/DashboardActionsContext';

const NutrientRow = ({ name, value, unit, goal, isTrackOnly = false }: { name: string, value: number, unit: string, goal: number, isTrackOnly?: boolean }) => {
    const percentage = goal > 0 && !isTrackOnly ? (value / goal) * 100 : value > 0 ? 100 : 0;
    const isOver = value > goal && !isTrackOnly;

    return (
        <div className="space-y-1">
            <div className="flex justify-between items-baseline">
                <p className="text-sm font-medium">{name.split(',')[0]}</p>
                <p className="text-sm text-muted-foreground">
                    <span className="font-bold text-foreground">{value.toFixed(isTrackOnly ? 1 : 0)}</span>
                    {!isTrackOnly && ` / ${goal.toFixed(0)}`}
                    <span className="text-xs"> {unit}</span>
                </p>
            </div>
            <Progress value={isOver ? 100 : percentage} />
        </div>
    )
}

const NutritionalSummaryDialog = ({ isOpen, onClose, summary, client, onEditGoals }: { isOpen: boolean, onClose: () => void, summary: any, client: ClientProfile | null, onEditGoals: () => void }) => {
    if (!summary?.allNutrients || !client) return null;
    
    const nutrientCategories = useMemo(() => {
        const macros = {
            'Energy': { unit: 'kcal' },
            'Protein': { unit: 'g' },
            'Total lipid (fat)': { unit: 'g' },
            'Carbohydrate, by difference': { unit: 'g' },
            'Fiber, total dietary': { unit: 'g' },
            'Sugars, added': { unit: 'g' }
        };
        const vitamins: Record<string, any> = {};
        const minerals: Record<string, any> = {};
        
        for (const key in rda) {
            if (!macros[key as keyof typeof macros]) {
                if (key.toLowerCase().includes('vitamin') || ['Thiamin', 'Riboflavin', 'Niacin', 'Folate, total'].includes(key)) {
                    vitamins[key] = rda[key as keyof typeof rda];
                } else {
                    minerals[key] = rda[key as keyof typeof rda];
                }
            }
        }
        return { macros, vitamins, minerals };
    }, []);

    // Directly use the saved goals. This is the single source of truth.
    const goals = client.customGoals;
    
    const renderSection = (title: string, keys: Record<string, any>) => (
        <AccordionItem value={title.toLowerCase()}>
            <AccordionTrigger>{title}</AccordionTrigger>
            <AccordionContent className="space-y-3">
                {Object.keys(keys).map(key => {
                    const nutrientData = summary.allNutrients[key];
                    const value = nutrientData?.value || 0;
                    const goal = goals?.[key as keyof NutritionalGoals] as number || rda[key as keyof typeof rda]?.value || 0;
                    const unit = keys[key]?.unit || 'g';
                    
                    return (
                        <NutrientRow
                            key={key}
                            name={key}
                            value={value}
                            unit={unit}
                            goal={goal}
                        />
                    );
                })}
            </AccordionContent>
        </AccordionItem>
    );

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Daily Nutritional Summary"
            description="A detailed breakdown of your nutrient intake for the day."
            className="max-w-lg"
        >
             <div className="max-h-[60vh] overflow-y-auto pr-6 -mr-6 space-y-4">
                <Accordion type="multiple" defaultValue={['macros', 'vitamins']} className="w-full">
                    <AccordionItem value="macros">
                         <AccordionTrigger>Macronutrients</AccordionTrigger>
                         <AccordionContent className="space-y-3">
                             <div className="p-2 rounded-md bg-muted/50 text-center relative">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Recommended Daily Calorie Range</p>
                                <p className="font-bold text-base">{Math.round(goals?.calorieGoalRange?.min || 0).toLocaleString()} - {Math.round(goals?.calorieGoalRange?.max || 0).toLocaleString()}</p>
                                 <Button variant="ghost" size="icon" className="absolute top-1/2 right-1 -translate-y-1/2 h-7 w-7 text-muted-foreground" onClick={onEditGoals}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                            <NutrientRow
                                name="Energy"
                                value={summary.allNutrients['Energy']?.value || 0}
                                unit="kcal"
                                goal={goals?.calorieGoal || 0}
                            />
                            <NutrientRow
                                name="Protein"
                                value={summary.allNutrients['Protein']?.value || 0}
                                unit="g"
                                goal={goals?.protein || 0}
                            />
                            <NutrientRow
                                name="Total lipid (fat)"
                                value={summary.allNutrients['Total lipid (fat)']?.value || 0}
                                unit="g"
                                goal={goals?.fat || 0}
                            />
                            <NutrientRow
                                name="Carbohydrate"
                                value={summary.allNutrients['Carbohydrate, by difference']?.value || 0}
                                unit="g"
                                goal={goals?.carbs || 0}
                            />
                             <NutrientRow
                                name="Fiber, total dietary"
                                value={summary.allNutrients['Fiber, total dietary']?.value || 0}
                                unit="g"
                                goal={goals?.fiber || 35}
                                isTrackOnly={true}
                            />
                             <NutrientRow
                                name="Sugars, added"
                                value={summary.allNutrients['Sugars, added']?.value || 0}
                                unit="g"
                                goal={0}
                                isTrackOnly={true}
                            />
                         </AccordionContent>
                    </AccordionItem>
                    {renderSection('Vitamins', nutrientCategories.vitamins)}
                    {renderSection('Minerals', nutrientCategories.minerals)}
                </Accordion>
            </div>
        </BaseModal>
    );
}

const DailySummaryBar = ({ summary, onSummaryClick }: { summary: any, onSummaryClick: () => void }) => {
    if (!summary) return null;
    
    return (
        <div className="flex-shrink-0 p-2 border-b bg-background/50 flex items-center justify-between gap-2">
            <div className="grid grid-cols-5 gap-1 text-center flex-1">
                <div className="flex flex-col items-center">
                    <UtensilsCrossed className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-bold">{summary.calories.toFixed(0)}</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">kcal</span>
                </div>
                 <div className="flex flex-col items-center">
                    <Droplet className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-bold">{summary.hydration.toFixed(0)}</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">oz</span>
                </div>
                 <div className="flex flex-col items-center">
                    <Moon className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-bold">{summary.sleep.toFixed(1)}</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">hr</span>
                </div>
                 <div className="flex flex-col items-center">
                    <Flame className="h-4 w-4 text-orange-400" />
                    <span className="text-xs font-bold">{summary.activity.toFixed(0)}</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">min</span>
                </div>
                 <div className="flex flex-col items-center">
                    <ShieldAlert className="h-4 w-4 text-red-400" />
                    <span className="text-xs font-bold">{summary.upf.toFixed(0)}%</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">UPF</span>
                </div>
            </div>
            <div className="flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSummaryClick}>
                    <ClipboardList className="h-5 w-5 text-muted-foreground" />
                </Button>
            </div>
        </div>
    )
}

interface CalendarDialogProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientProfile;
  initialDate?: Date;
}

export function CalendarDialog({ isOpen, onClose, client: initialClient, initialDate }: CalendarDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [fullClientProfile, setFullClientProfile] = useState<ClientProfile | null>(initialClient);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState('account');
  const [settingsDefaultAccordion, setSettingsDefaultAccordion] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  const fetchClientProfile = useCallback(async () => {
    if (!initialClient.uid) return;
    const result = await getClientByIdAction(initialClient.uid);
    if (result.success && result.data) {
        setFullClientProfile(result.data);
    }
  }, [initialClient.uid]);
  
  useEffect(() => {
    // This effect ensures that if the settings dialog is closed, we refetch the
    // client profile to get the latest goal data.
    if (!isSettingsOpen) {
      fetchClientProfile();
    }
  }, [isSettingsOpen, fetchClientProfile]);


  const fetchEntries = useCallback(async (date: Date) => {
      setIsLoading(true);
      const result = await getCalendarDataForDay(initialClient.uid, date.toISOString().split('T')[0]);
      if (result.success && result.data) {
          setEntries(result.data);
      } else {
          console.error("Failed to fetch calendar data:", result.error);
          setEntries([]);
      }
      setIsLoading(false);
  }, [initialClient.uid]);

  useEffect(() => {
      if (isOpen) {
          fetchClientProfile();
          fetchEntries(selectedDate);
      }
  }, [isOpen, selectedDate, fetchEntries, fetchClientProfile]);

  const handleEditGoals = () => {
    setIsSummaryOpen(false); // Close the summary dialog
    // A short delay ensures the summary dialog is closed before the settings dialog opens
    setTimeout(() => {
        setSettingsDefaultTab('account'); // Or whichever tab your goals are on
        setSettingsDefaultAccordion('goals');
        setIsSettingsOpen(true);
    }, 150);
  };

  const handleSummaryClick = () => {
    if (fullClientProfile?.trackingSettings?.nutrition === false) {
        toast({
            title: "Nutrition Tracking Disabled",
            description: "Please enable nutrition tracking in your settings to view the summary.",
        });
        return;
    }
    setIsSummaryOpen(true);
  };

  const dailySummary = useMemo(() => {
    if (!entries) return null;
      let calories = 0, hydration = 0, sleep = 0, activity = 0, totalUpfScore = 0, upfMeals = 0;
      const allNutrients: { [key: string]: { value: number, unit: string } } = {};
      entries.forEach(entry => {
        if (entry.pillar === 'nutrition' && entry.summary?.nutrients) {
            Object.entries(entry.summary.nutrients).forEach(([key, nutrient]: [string, any]) => {
                if (typeof nutrient.value === 'number') {
                    if (!allNutrients[key]) allNutrients[key] = { value: 0, unit: nutrient.unit };
                    allNutrients[key].value += nutrient.value;
                }
            });
            calories += entry.summary.nutrients.Energy?.value || 0;
        }
        if (entry.pillar === 'hydration') hydration += entry.amount || 0;
        if (entry.pillar === 'sleep' && !entry.isNap) sleep += entry.duration || 0;
        if (entry.pillar === 'activity') activity += entry.duration || 0;
        if (entry.pillar === 'nutrition' && entry.summary?.upf) {
            totalUpfScore += entry.summary.upf.score;
            upfMeals++;
        }
      });
      return { calories, hydration, sleep, activity, upf: upfMeals > 0 ? (totalUpfScore / upfMeals) : 0, allNutrients };
  }, [entries]);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-7xl h-[90dvh] flex flex-col p-0">
         <DialogHeader className="p-0 -m-2">
            <DialogTitle srOnly>{initialClient.fullName}'s Calendar</DialogTitle>
            <DialogDescription srOnly>View and manage calendar entries.</DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col h-full w-full">
            <div className="flex-shrink-0">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
                    <div className="p-2 border-b">
                        <TabsList className="grid w-full grid-cols-3 mx-auto max-w-xs">
                            <TabsTrigger value="day">Day</TabsTrigger>
                            <TabsTrigger value="week">Week</TabsTrigger>
                            <TabsTrigger value="month">Month</TabsTrigger>
                        </TabsList>
                    </div>
                </Tabs>
                {activeTab === 'day' && <DailySummaryBar summary={dailySummary} onSummaryClick={handleSummaryClick} />}
            </div>
            <div className="flex-1 min-h-0">
              {activeTab === 'day' && <DayView client={initialClient} selectedDate={selectedDate} entries={entries} isLoading={isLoading} onDateChange={setSelectedDate} onEntryChange={() => fetchEntries(selectedDate)} />}
              {activeTab === 'week' && <WeekView client={initialClient} selectedDate={selectedDate} setSelectedDate={setSelectedDate} setActiveTab={setActiveTab} entries={entries} isLoading={isLoading} onDateChange={setSelectedDate}/>}
              {activeTab === 'month' && <MonthView client={initialClient} selectedDate={selectedDate} setSelectedDate={setSelectedDate} setActiveTab={setActiveTab} entries={entries} isLoading={isLoading} onDateChange={setSelectedDate}/>}
            </div>
        </div>
      </DialogContent>
    </Dialog>
    <NutritionalSummaryDialog 
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        summary={dailySummary}
        client={fullClientProfile}
        onEditGoals={handleEditGoals}
    />
    <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        defaultTab="account"
        defaultAccordion={settingsDefaultAccordion}
    />
    </>
  );
}
