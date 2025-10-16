
'use client';

import * as React from 'react';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, ChevronLeft, ChevronRight, X, Trophy, Pencil, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';
import { Challenge, CustomHabit } from '@/services/firestore';
import { format, eachDayOfInterval, startOfDay, isSameDay, isToday, differenceInCalendarDays } from 'date-fns';
import { logChallengeProgressAction, getAllDataForPeriod } from '@/services/firestore';
import { pillarsAndTools } from '@/lib/pillars';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '../ui/card';
import { Flame, Star } from 'lucide-react';
import { getCustomHabitsAction } from '@/app/coach/habits/actions';
import { BaseModal } from '@/components/ui/base-modal';
import { ChatView } from '../chats/chat-view';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GenerateChallengeInsightOutput } from '@/ai/flows/generate-challenge-insight';
import { AppNumberInput } from '../ui/number-input';
import { EmbeddedChatDialog } from '../coach/chats/embedded-chat-dialog';


type SerializableChallenge = Omit<Challenge, 'dates' | 'createdAt' | 'progress'> & {
    dates: { from: string, to: string };
    createdAt?: string;
    progress?: {
        [userId: string]: {
            [date: string]: {
                [task: string]: boolean | number;
            }
        }
    };
};

interface ClientChallengeDetailModalProps {
    challenge: SerializableChallenge;
    isOpen: boolean;
    onClose: () => void;
}

const ChallengeProgress = ({ challenge, userLogs, user }: { challenge: SerializableChallenge, userLogs: any[], user: any }) => {
    
    const allTasks = useMemo(() => {
        const tasks = [];
        if (challenge.scheduledPillars) {
            tasks.push(...challenge.scheduledPillars.map(p => `Log ${pillarsAndTools.find(pt => pt.id === p.pillarId)?.label || p.pillarId}`));
        }
        if (challenge.customTasks) {
            tasks.push(...challenge.customTasks.map(t => t.description));
        }
        return tasks;
    }, [challenge]);

    const streakData = useMemo(() => {
        if (!user || !challenge.progress || !challenge.progress[user.uid]) {
            return allTasks.map(task => ({ task, currentStreak: 0, bestStreak: 0 }));
        }

        const userProgress = challenge.progress[user.uid];
        
        return allTasks.map(task => {
            let bestStreak = 0;
            let currentStreak = 0;
            let tempStreak = 0;
            const today = startOfDay(new Date());
            const challengeStartDate = startOfDay(new Date(challenge.dates.from));
            
            // Check for current streak
            let checkDate = new Date(today);
            while(checkDate >= challengeStartDate) {
                const dateStr = format(checkDate, 'yyyy-MM-dd');
                 if (userProgress[dateStr] && userProgress[dateStr][task]) {
                    currentStreak++;
                } else {
                    break;
                }
                checkDate.setDate(checkDate.getDate() - 1);
            }
            
            // Check for best streak
            let dateIterator = new Date(challengeStartDate);
            while(dateIterator <= today) {
                 const dateStr = format(dateIterator, 'yyyy-MM-dd');
                 if (userProgress[dateStr] && userProgress[dateStr][task]) {
                     tempStreak++;
                 } else {
                     bestStreak = Math.max(bestStreak, tempStreak);
                     tempStreak = 0;
                 }
                 dateIterator.setDate(dateIterator.getDate() + 1);
            }
            bestStreak = Math.max(bestStreak, tempStreak);


            return { task, currentStreak, bestStreak };
        });

    }, [challenge, user, allTasks]);


    return (
        <div className="p-4 space-y-4">
            <Card className="bg-amber-400/10 border-amber-400/30">
                <CardContent className="p-3">
                    <h3 className="font-bold text-center text-amber-300 mb-2">Trophy Case</h3>
                    <div className="flex justify-center items-center h-20">
                        <p className="text-sm text-amber-300/70">Awards and trophies coming soon!</p>
                    </div>
                </CardContent>
            </Card>
            
            <div className="space-y-2">
                 <h3 className="font-bold text-center text-white/80">Your Streaks</h3>
                 {streakData.map(({ task, currentStreak, bestStreak }) => (
                    <Card key={task} className="bg-background/30 border-white/20">
                        <CardContent className="p-2 flex justify-between items-center text-white">
                            <p className="text-xs font-semibold flex-1 truncate pr-2">{task}</p>
                            <div className="flex items-center gap-3 text-xs">
                                <div className="flex items-center gap-1">
                                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                                    <span>{currentStreak}</span>
                                </div>
                                 <div className="flex items-center gap-1">
                                    <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                                    <span>{bestStreak}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}

// Memoize DailyTasks to prevent re-renders that cause the input to lose focus.
const DailyTasks = React.memo(({
    currentDay,
    currentDayIndex,
    days,
    challenge,
    isLoading,
    dataLoadError,
    userLogs,
    customHabits,
    getTaskProgressValue,
    isPillarTaskCompleteAutomatically,
    handleProgressChange,
    setCurrentDayIndex,
    hasUnsavedChanges,
    handleSaveProgress,
    isSaving,
}: any) => {
 return (
        <div className="flex flex-col h-full">
            <div className="p-4 flex items-center justify-between gap-1 flex-shrink-0 bg-background rounded-t-lg">
                <Button variant="ghost" size="icon" onClick={() => setCurrentDayIndex((i: number) => i - 1)} disabled={currentDayIndex === 0}>
                    <ChevronLeft className="h-6 w-6" />
                </Button>
                <div className="text-center">
                    <p className="font-bold">{format(currentDay, 'MM/dd/yy')}</p>
                    <p className="text-xs text-muted-foreground">Day {currentDayIndex + 1} of {days.length}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setCurrentDayIndex((i: number) => i + 1)} disabled={currentDayIndex === days.length - 1}>
                    <ChevronRight className="h-6 w-6" />
                </Button>
            </div>
            {isLoading ? (
                <div className="flex-1 flex justify-center items-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : dataLoadError ? (
                 <div className="flex-1 flex flex-col justify-center items-center text-center p-4">
                    <p className="text-destructive font-semibold">Could not load activity data.</p>
                    <p className="text-xs text-muted-foreground">{dataLoadError}</p>
                 </div>
            ) : (
                 <ScrollArea className="flex-1">
                    <div className="p-4 pt-2 space-y-3">
                        {challenge.scheduledPillars?.map((pillarInfo: any, i: number) => {
                            const pillar = pillarsAndTools.find(p => p.id === pillarInfo.pillarId);
                            if (!pillar) return null;
                            const taskDescription = `Log ${pillar.label}`;
                            const isAutoCompleted = isPillarTaskCompleteAutomatically(currentDay, pillar.id);
                            const progressValue = getTaskProgressValue(taskDescription);
                            const isCompleted = isAutoCompleted || !!progressValue;
                            
                            return (
                                <div key={`pillar-${i}`} className="flex items-center space-x-3 p-3 rounded-md bg-muted/50">
                                    <Checkbox 
                                        id={`${format(currentDay, 'yyyy-MM-dd')}-${pillar.id}`}
                                        checked={isCompleted}
                                        onCheckedChange={(checked) => handleProgressChange(taskDescription, !!checked)}
                                        disabled={isAutoCompleted}
                                    />
                                    <Label htmlFor={`${format(currentDay, 'yyyy-MM-dd')}-${pillar.id}`} className={cn("text-sm", isCompleted && "line-through text-muted-foreground")}>
                                        {taskDescription}
                                    </Label>
                                    {isAutoCompleted && <CheckCircle className="h-4 w-4 text-green-500" />}
                                </div>
                            )
                        })}
                        {challenge.customTasks?.map((task: any, index: number) => {
                            const progressValue = getTaskProgressValue(task.description);
                            const isUserRecords = task.goalType === 'user-records';
                            const goalText = task.goalType === 'static' ? task.goal : task.startingGoal;

                            if (isUserRecords) {
                                return (
                                    <div key={`${task.description}-${index}`} className="flex flex-col gap-2 p-3 rounded-md bg-muted/50">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor={`${task.description}-${index}`} className="flex-1 text-sm">{task.description}</Label>
                                            <AppNumberInput
                                                id={`${task.description}-${index}`}
                                                placeholder="0"
                                                value={progressValue as number | string || ''}
                                                onChange={(value) => handleProgressChange(task.description, value)}
                                                className="h-8 text-sm w-20"
                                                min={0}
                                                maxLength={3}
                                            />
                                            <span className="text-sm text-muted-foreground">{task.unit}</span>
                                        </div>
                                        {task.notes && (
                                            <div className="text-xs text-muted-foreground flex gap-2 items-start">
                                                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                                <span>{task.notes}</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            }
                            
                            // For static/progressive tasks
                            const isCompleted = !!progressValue;
                            return(
                            <div key={`${task.description}-${index}`} className="p-3 rounded-md bg-muted/50 space-y-2">
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id={task.description}
                                        checked={isCompleted}
                                        onCheckedChange={(checked) => handleProgressChange(task.description, !!checked)}
                                    />
                                    <div className={cn("flex-1 text-sm", isCompleted && "line-through text-muted-foreground")}>
                                        <Label htmlFor={task.description}>{task.description}</Label>
                                        <span className="text-xs text-muted-foreground ml-1">({goalText} {task.unit})</span>
                                    </div>
                                </div>
                                {task.notes && (
                                    <div className="text-xs text-muted-foreground pt-1 border-t border-white/10 flex gap-2 items-start">
                                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                        <span>{task.notes}</span>
                                    </div>
                                )}
                            </div>
                        )})}
                         {challenge.scheduledHabits?.map((habit: any, i: number) => {
                             const habitDetails = customHabits.find(h => h.id === habit.habitId) || { name: `Habit ${i+1}`, description: 'Complete this habit.' };
                             const isCompleted = !!getTaskProgressValue(habitDetails.name);
                             return (
                                <div key={`habit-${i}`} className="p-3 rounded-md bg-muted/50 space-y-2">
                                    <div className="flex items-center space-x-3">
                                        <Checkbox
                                            id={`habit-${format(currentDay, 'yyyy-MM-dd')}-${i}`}
                                            checked={isCompleted}
                                            onCheckedChange={(checked) => handleProgressChange(habitDetails.name, !!checked)}
                                        />
                                        <Label htmlFor={`habit-${format(currentDay, 'yyyy-MM-dd')}-${i}`} className={cn("text-sm", isCompleted && "line-through text-muted-foreground")}>
                                            {habitDetails.name}
                                        </Label>
                                    </div>
                                    {habit.notes && (
                                        <div className="text-xs text-muted-foreground pt-1 border-t border-white/10 flex gap-2 items-start">
                                            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                            <span>{habit.notes}</span>
                                        </div>
                                    )}
                                </div>
                             )
                         })}
                    </div>
                </ScrollArea>
            )}
             {hasUnsavedChanges && (
                <div className="p-4 pt-0">
                    <Button onClick={handleSaveProgress} disabled={isSaving} className="w-full">
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Progress for Day
                    </Button>
                </div>
            )}
        </div>
    );
});
DailyTasks.displayName = 'DailyTasks';


export function ClientChallengeDetailModal({ challenge: initialChallenge, isOpen, onClose }: ClientChallengeDetailModalProps) {
    const { toast } = useToast();
    const { user, userProfile } = useAuth();
    const [challenge, setChallenge] = useState(initialChallenge);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [userLogs, setUserLogs] = useState<any[]>([]);
    const [customHabits, setCustomHabits] = useState<CustomHabit[]>([]);
    const [unsavedProgress, setUnsavedProgress] = useState<Record<string, boolean | number>>({});
    const hasUnsavedChanges = Object.keys(unsavedProgress).length > 0;
    const [dataLoadError, setDataLoadError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('tasks');
    const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);


    const fetchInitialData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        setDataLoadError(null);
        try {
            const today = new Date();
            const challengeStartDate = new Date(initialChallenge.dates.from);
            const daysToFetch = Math.max(0, differenceInCalendarDays(today, challengeStartDate) + 1);

            const [logsResult, habitsResult] = await Promise.all([
                getAllDataForPeriod(daysToFetch, user.uid, challengeStartDate),
                getCustomHabitsAction()
            ]);

            if (!logsResult.success) {
                throw new Error(logsResult.error || 'Could not load your activity logs for this challenge.');
            }
            
            setUserLogs(logsResult.data || []);

            if (habitsResult.success && habitsResult.data) {
                setCustomHabits(habitsResult.data);
            }

        } catch (error: any) {
            console.error("Error fetching initial challenge data:", error);
            setDataLoadError(error.message);
        } finally {
            setIsLoading(false);
        }
    }, [user, initialChallenge.dates.from]);

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            setChallenge(initialChallenge); // Reset challenge state on open
            setActiveTab('tasks'); // Reset to tasks tab
        }
    }, [isOpen, initialChallenge, fetchInitialData]);

    const days = useMemo(() => {
        const from = new Date(initialChallenge.dates.from);
        const to = new Date(initialChallenge.dates.to);
        return eachDayOfInterval({ start: from, end: to });
    }, [initialChallenge.dates.from, initialChallenge.dates.to]);
    
    const todayIndex = useMemo(() => days.findIndex(day => isToday(day)), [days]);

    const [currentDayIndex, setCurrentDayIndex] = useState(todayIndex > -1 ? todayIndex : 0);
    
    useEffect(() => {
        setCurrentDayIndex(todayIndex > -1 ? todayIndex : 0);
    }, [todayIndex]);
    
    useEffect(() => {
        // Reset unsaved progress when the day changes
        setUnsavedProgress({});
    }, [currentDayIndex]);

    const currentDay = days[currentDayIndex];
    
    const handleProgressChange = useCallback((taskDescription: string, value: boolean | number | '') => {
        setUnsavedProgress(prev => ({
            ...prev,
            [taskDescription]: value,
        }));
    }, []);
    
    const handleSaveProgress = useCallback(async () => {
        if (!user || !currentDay || !hasUnsavedChanges) return;

        setIsSaving(true);
        const dateString = format(startOfDay(currentDay), 'yyyy-MM-dd');

        try {
            const result = await logChallengeProgressAction({
                userId: user.uid,
                challengeId: challenge.id,
                date: dateString,
                progress: unsavedProgress,
            });

            if (result.success) {
                // Merge unsaved progress into the main challenge state
                setChallenge(prev => {
                    const newProgress = { ...prev.progress };
                    if (!newProgress[user.uid]) newProgress[user.uid] = {};
                    if (!newProgress[user.uid][dateString]) newProgress[user.uid][dateString] = {};
                    newProgress[user.uid][dateString] = {
                        ...newProgress[user.uid][dateString],
                        ...unsavedProgress,
                    };
                    return { ...prev, progress: newProgress };
                });

                setUnsavedProgress({}); // Clear unsaved changes
                toast({
                    title: "Progress Saved!",
                    description: "Your challenge progress for the day has been updated.",
                    ...((result.insight && {
                        title: result.insight.title,
                        description: result.insight.message,
                    }) || {})
                });
            } else {
                throw new Error(result.error || 'Failed to save progress.');
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: error.message
            });
        } finally {
            setIsSaving(false);
        }
    }, [user, currentDay, hasUnsavedChanges, challenge.id, unsavedProgress, toast]);


    const getTaskProgressValue = useCallback((taskDescription: string) => {
        const dateString = format(startOfDay(currentDay), 'yyyy-MM-dd');
        // Prioritize unsaved changes for immediate UI feedback
        if (unsavedProgress.hasOwnProperty(taskDescription)) {
            return unsavedProgress[taskDescription];
        }
        // Fallback to saved progress
        return challenge.progress?.[user.uid]?.[dateString]?.[taskDescription];
    }, [challenge.progress, currentDay, unsavedProgress, user.uid]);

    const isPillarTaskCompleteAutomatically = useCallback((date: Date, pillarId: string): boolean => {
        if (!date) return false;
        const dayLogs = userLogs.filter(log => log.entryDate && isSameDay(new Date(log.entryDate), date));
        
        if (pillarId === 'hydration') {
             const todaysHydration = dayLogs.filter(l => l.pillar === 'hydration').reduce((sum, l) => sum + (l.amount || 0), 0);
             const goal = userProfile?.suggestedHydrationGoal || 64;
             return todaysHydration >= goal;
        }
        return dayLogs.some(log => log.pillar === pillarId);
    }, [userLogs, userProfile?.suggestedHydrationGoal]);

    const handleTabChange = (value: string) => {
        if (value === 'chat') {
            setIsChatDialogOpen(true);
            // Immediately switch back to the tasks tab visually
            setTimeout(() => setActiveTab('tasks'), 0);
        } else {
            setActiveTab(value);
        }
    }

    return (
        <>
            <BaseModal
                isOpen={isOpen}
                onClose={onClose}
                title={initialChallenge.name}
                className="w-[90vw] max-w-4xl h-[90vh] bg-background shadow-2xl p-0"
            >
                <div className="h-full flex flex-col">
                    <div className="p-3 border-b flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                            <Image src={initialChallenge.thumbnailUrl || 'https://placehold.co/100x100.png'} alt={initialChallenge.name} fill className="object-cover" unoptimized/>
                        </div>
                        <h2 className="text-base font-bold tracking-tight text-left flex-1">{initialChallenge.name}</h2>
                    </div>
                    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex-1 min-h-0">
                            <TabsContent value="tasks" className="m-0 h-full">
                                <DailyTasks
                                    currentDay={currentDay}
                                    currentDayIndex={currentDayIndex}
                                    days={days}
                                    challenge={challenge}
                                    isLoading={isLoading}
                                    dataLoadError={dataLoadError}
                                    userLogs={userLogs}
                                    customHabits={customHabits}
                                    getTaskProgressValue={getTaskProgressValue}
                                    isPillarTaskCompleteAutomatically={isPillarTaskCompleteAutomatically}
                                    handleProgressChange={handleProgressChange}
                                    setCurrentDayIndex={setCurrentDayIndex}
                                    hasUnsavedChanges={hasUnsavedChanges}
                                    handleSaveProgress={handleSaveProgress}
                                    isSaving={isSaving}
                                />
                            </TabsContent>
                            <TabsContent value="progress" className="m-0 h-full">
                                <ChallengeProgress challenge={challenge} userLogs={userLogs} user={user} />
                            </TabsContent>
                        </div>
                        <div className="p-2 border-t">
                            <TabsList className="grid w-full grid-cols-3 mx-auto max-w-sm mt-auto flex-shrink-0">
                                <TabsTrigger value="tasks">Daily Tasks</TabsTrigger>
                                <TabsTrigger value="progress">Trophies</TabsTrigger>
                                <TabsTrigger value="chat">Chat</TabsTrigger>
                            </TabsList>
                        </div>
                    </Tabs>
                </div>
            </BaseModal>

            {isChatDialogOpen && (
                <EmbeddedChatDialog
                    isOpen={isChatDialogOpen}
                    onClose={() => setIsChatDialogOpen(false)}
                    chatId={challenge.id}
                    chatName={challenge.name}
                />
            )}
        </>
    );
}

    

    