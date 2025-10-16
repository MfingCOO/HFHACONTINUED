
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { generateHolisticInsight, GenerateHolisticInsightOutput } from '@/ai/flows/generate-holistic-insight';
import { getStressAndHungerSpotlight } from '@/services/firestore';
import { Loader2, Lightbulb, Sparkles, CheckCircle, BrainCircuit, X, TrendingUp, Heart, HeartCrack, ShieldAlert, Apple, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '../auth/auth-provider';
import { UpgradeModal } from '../modals/upgrade-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import Image from 'next/image';
import { getAssetLibrary } from '@/services/assets';
import { WeightTrendChartDialog } from './weight-trend-chart';
import { WthrTrendChartDialog } from './wthr-trend-chart';
import { Separator } from '../ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { ScrollArea } from '../ui/scroll-area';
import { HabitHighlightsDisplay } from './habit-highlights';
import type { LucideIcon } from 'lucide-react';

interface InsightsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SpotlightInsight {
    icon: string;
    title: string;
    message: string;
}

const spotlightIcons: Record<string, LucideIcon> = {
    HeartCrack,
    ShieldAlert,
    Apple,
    Zap
};

export function InsightsDialog({ isOpen, onClose }: InsightsDialogProps) {
    const { toast } = useToast();
    const { user, userProfile } = useAuth();
    
    const [insight, setInsight] = useState<GenerateHolisticInsightOutput | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [insightPeriod, setInsightPeriod] = useState<number>(7);
    const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
    const [insightError, setInsightError] = useState<string | null>(null);
    const [isWeightChartOpen, setIsWeightChartOpen] = useState(false);
    const [isWthrChartOpen, setIsWthrChartOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    
    const [spotlightInsight, setSpotlightInsight] = useState<SpotlightInsight | null>(null);
    const [isSpotlightLoading, setIsSpotlightLoading] = useState(true);

    useEffect(() => {
        setIsMounted(true);
    }, []);
    
    const handleGenerateInsight = async () => {
        if (!user) return;
        setIsGenerating(true);
        setInsight(null);
        setInsightError(null);
        try {
            const insightResult = await generateHolisticInsight({ userId: user.uid, periodInDays: insightPeriod });
            setInsight(insightResult);

        } catch (error: any) {
            console.error("Error generating insight:", error);
            if (error.message.includes('Not enough data')) {
                 setInsightError(`Log at least one activity in the last ${insightPeriod} days to get your insight.`);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Could not generate an insight. Please try again.',
                });
            }
        } finally {
            setIsGenerating(false);
        }
    };
    
    useEffect(() => {
        if (isOpen && user) {
            getAssetLibrary().then(result => {
                if (result.success && result.data?.insightsPopupUrl) {
                    setBackgroundImageUrl(result.data.insightsPopupUrl);
                } else {
                    setBackgroundImageUrl('https://placehold.co/1200x400.png');
                }
            });
            
            setIsSpotlightLoading(true);
            getStressAndHungerSpotlight(user.uid).then(result => {
                if (result.success && result.data) {
                    setSpotlightInsight(result.data);
                }
                setIsSpotlightLoading(false);
            });
        }
    }, [isOpen, user]);

    if (userProfile?.tier === 'free') {
        return (
             <UpgradeModal
                isOpen={isOpen}
                onClose={onClose}
                requiredTier="basic"
                featureName="Personalized Insights"
                reason="Unlock deeper understanding of your habits for effortless progress."
            />
        )
    }

    const SpotlightIcon = spotlightInsight ? spotlightIcons[spotlightInsight.icon] : null;

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[90vw] sm:max-w-lg h-[90dvh] p-0 flex flex-col bg-black/25">
                 <div className="absolute inset-0">
                    {backgroundImageUrl && (
                        <Image 
                            src={backgroundImageUrl} 
                            alt="Insights" 
                            fill 
                            className="object-cover"
                            unoptimized
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent z-0" />
                </div>
                <div className="relative z-10 flex flex-col flex-1 min-h-0 pt-4 pb-4">
                     <DialogHeader className="p-4 flex-shrink-0 text-center">
                         <DialogTitle className="text-lg font-bold tracking-tight text-pop">Insights</DialogTitle>
                         <DialogDescription className="text-pop px-4 text-xs italic font-light">Discover patterns in your journey.</DialogDescription>
                    </DialogHeader>

                     <div className="flex-1 min-h-0">
                         <ScrollArea className="h-full">
                            <div className="p-4 space-y-4">
                                <Accordion type="multiple" defaultValue={['ai-coach', 'spotlight']} className="w-full space-y-4">
                                    
                                     <AccordionItem value="spotlight" className="bg-black/40 rounded-lg border-b-0">
                                        <AccordionTrigger className="p-4 text-base text-white hover:no-underline">Daily Spotlight</AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4">
                                            {isSpotlightLoading ? (
                                                <div className="flex items-center justify-center p-8 rounded-lg bg-white/5">
                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                </div>
                                            ) : spotlightInsight && SpotlightIcon ? (
                                                 <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                                                    <SpotlightIcon className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                                                    <div>
                                                        <h4 className="font-semibold text-sm text-white">{spotlightInsight.title}</h4>
                                                        <p className="text-sm text-white/80">{spotlightInsight.message}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-center text-sm text-white/70">No spotlight insight available right now.</p>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>

                                    <AccordionItem value="ai-coach" className="bg-black/40 rounded-lg border-b-0">
                                        <AccordionTrigger className="p-4 text-base text-white hover:no-underline">Hunger-Free and Happy Analysis</AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4">
                                            <div className="flex flex-col sm:flex-row items-center gap-2 mb-2">
                                                <Select onValueChange={(v) => setInsightPeriod(parseInt(v))} defaultValue="7">
                                                    <SelectTrigger className="w-full sm:w-auto bg-background text-foreground">
                                                        <SelectValue placeholder="Select time period" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="3">Last 3 Days</SelectItem>
                                                        <SelectItem value="7">Last 7 Days</SelectItem>
                                                        <SelectItem value="14">Last 14 Days</SelectItem>
                                                        <SelectItem value="30">Last 30 Days</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button onClick={handleGenerateInsight} disabled={isGenerating} className="w-full flex-1">
                                                    {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : `Generate`}
                                                </Button>
                                            </div>
                                             {insightError && <p className="text-center text-xs text-amber-300 p-2">{insightError}</p>}
                                            
                                            {isGenerating ? (
                                                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 bg-white/5 p-8 text-center min-h-[150px]">
                                                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                                                    <p className="font-semibold text-white">Analyzing your data...</p>
                                                </div>
                                            ) : insight ? (
                                                <div className="rounded-lg bg-black/50 p-4 shadow-inner space-y-3 animate-in fade-in-50 text-white">
                                                    <h3 className="text-lg font-bold text-primary flex items-center gap-2"><Sparkles className="h-5 w-5" /> {insight.title}</h3>
                                                    <div className="space-y-1">
                                                        <h4 className="font-semibold text-sm">Pattern:</h4>
                                                        <p className="text-sm text-white/80">{insight.pattern}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <h4 className="font-semibold text-sm">Explanation:</h4>
                                                        <p className="text-sm text-white/80">{insight.explanation}</p>
                                                    </div>
                                                    <div className="bg-primary/10 border-l-4 border-primary p-3 rounded-r-lg">
                                                        <h4 className="font-semibold flex items-center gap-2 text-sm text-primary"><CheckCircle className="h-4 w-4" /> Suggestion:</h4>
                                                        <p className="text-white/90 text-sm">{insight.suggestion}</p>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </AccordionContent>
                                    </AccordionItem>
                                    
                                     {isMounted && (
                                        <div className="bg-black/40 rounded-lg p-4 space-y-2">
                                            <Button variant="outline" className="w-full bg-transparent text-white" onClick={() => setIsWeightChartOpen(true)}>
                                                <TrendingUp className="mr-2 h-4 w-4" />
                                                Analyze Weight Trend
                                            </Button>
                                            <Button variant="outline" className="w-full bg-transparent text-white" onClick={() => setIsWthrChartOpen(true)}>
                                                <Heart className="mr-2 h-4 w-4" />
                                                Analyze WtHR Trend
                                            </Button>
                                        </div>
                                     )}

                                    <AccordionItem value="habit-highlights" className="bg-black/40 rounded-lg border-b-0">
                                        <AccordionTrigger className="p-4 text-base text-white hover:no-underline">Habit Highlights (Last 7 Days)</AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4">
                                            <HabitHighlightsDisplay />
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
        {isMounted && (
             <WeightTrendChartDialog 
                isOpen={isWeightChartOpen}
                onClose={() => setIsWeightChartOpen(false)}
            />
        )}
        {isMounted && (
             <WthrTrendChartDialog 
                isOpen={isWthrChartOpen}
                onClose={() => setIsWthrChartOpen(false)}
            />
        )}
        </>
    );
}
