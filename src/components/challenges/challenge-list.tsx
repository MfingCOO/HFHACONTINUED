
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { joinChallenge } from "@/services/firestore";
import { useAuth } from "@/components/auth/auth-provider";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { format, formatDistance, differenceInCalendarDays, isPast } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, Calendar, ArrowRight } from "lucide-react";
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import { getChallengesForClient } from "@/app/challenges/actions";
import type { Challenge } from "@/services/firestore";
import { ClientChallengeDetailModal } from "./client-challenge-detail-modal";
import { TIER_ACCESS } from "@/types";

// This component contains the logic for fetching and displaying challenges.
// It is now a reusable component instead of a full page.
export function ChallengeList() {
    const { user, userProfile } = useAuth();
    const { toast } = useToast();
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isJoining, setIsJoining] = useState<string | null>(null);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);


    useEffect(() => {
        const fetchChallenges = async () => {
            if (!user) return;
            setIsLoading(true);
            const result = await getChallengesForClient();
            if (result.success && result.data) {
                const formattedChallenges = result.data.map((c: any) => ({
                    ...c,
                    dates: {
                        from: new Date(c.dates.from),
                        to: new Date(c.dates.to)
                    }
                }));
                setChallenges(formattedChallenges);
            }
            setIsLoading(false);
        };
        fetchChallenges();
    }, [user]);

    const handleJoinChallenge = async (challengeId: string) => {
        if (!user || !userProfile) return;
        
        const requiredTierIndex = TIER_ACCESS.indexOf('premium');
        const currentTierIndex = TIER_ACCESS.indexOf(userProfile.tier);

        if (currentTierIndex < requiredTierIndex) {
            setIsUpgradeModalOpen(true);
            return;
        }

        setIsJoining(challengeId);
        try {
            const result = await joinChallenge(challengeId, user.uid);
            if (result.success) {
                toast({
                    title: "Challenge Joined!",
                    description: "You are now a participant. Good luck!",
                });
                // Optimistically update the UI
                setChallenges(prev => prev.map(c => 
                    c.id === challengeId 
                        ? { ...c, participants: [...(c.participants || []), user.uid], participantCount: (c.participantCount || 0) + 1 } 
                        : c
                ));
            } else {
                 throw new Error(result.error?.toString() || 'Could not join challenge.');
            }
        } catch (error) {
             console.error("Error joining challenge:", error);
             toast({
                variant: "destructive",
                title: "Error",
                description: "There was a problem joining the challenge. Please try again.",
            });
        } finally {
            setIsJoining(null);
        }
    }
    
    const joinedChallenges = challenges.filter(challenge => user && (challenge.participants || []).includes(user.uid));
    const availableChallenges = challenges.filter(challenge => !user || !(challenge.participants || []).includes(user.uid));


    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-24">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <>
        <div className="flex flex-col items-center space-y-8">
            
            {/* Joined Challenges Section */}
            {joinedChallenges.length > 0 && (
                 <div className="w-full max-w-sm space-y-3">
                    <h2 className="text-2xl font-bold tracking-tight text-center">My Challenges</h2>
                    {joinedChallenges.map(challenge => (
                        <Card key={challenge.id} className="overflow-hidden cursor-pointer hover:border-primary/50" onClick={() => setSelectedChallenge(challenge)}>
                            <CardContent className="p-2 flex flex-row gap-3 items-center">
                                <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden">
                                    <Image
                                        src={challenge.thumbnailUrl || 'https://placehold.co/400x400.png'}
                                        alt={challenge.name}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                    {isPast(challenge.dates.to) && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Badge variant="secondary">Ended</Badge></div>}
                                </div>
                                <div className="flex-1 flex flex-col justify-between self-stretch">
                                    <div>
                                        <h3 className="font-semibold text-sm leading-tight">{challenge.name}</h3>
                                        <p className="text-xs text-muted-foreground line-clamp-1">{challenge.description}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                            <div className="flex items-center gap-1"><Users className="w-3 h-3" /> <span>{challenge.participantCount}/{challenge.maxParticipants}</span></div>
                                            <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> <span>Ends in {formatDistance(challenge.dates.to, new Date(), { addSuffix: true })}</span></div>
                                        </div>
                                    </div>
                                    <Button size="sm" className="w-full h-7 mt-1 text-xs" onClick={() => setSelectedChallenge(challenge)}>
                                        View Progress <ArrowRight className="ml-1 h-3 w-3" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
           
            {/* Available Challenges Section */}
             <div className="w-full max-w-sm space-y-3">
                <h2 className="text-2xl font-bold tracking-tight text-center">Available Challenges</h2>
                 {availableChallenges.length > 0 ? (
                    availableChallenges.map(challenge => {
                        const hasJoined = user ? (challenge.participants || []).includes(user.uid) : false;
                        const isFull = challenge.participantCount >= challenge.maxParticipants;
                        const challengeEnded = isPast(challenge.dates.to);
                        
                        let buttonText = "Join Challenge";
                        if (isFull && !hasJoined) buttonText = "Full";
                        if (challengeEnded && !hasJoined) buttonText = "Ended";

                        return (
                            <Card key={challenge.id} className="overflow-hidden">
                                <CardContent className="p-2 flex flex-row gap-3 items-center">
                                    <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden">
                                        <Image
                                            src={challenge.thumbnailUrl || 'https://placehold.co/400x400.png'}
                                            alt={challenge.name}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between self-stretch">
                                        <div>
                                            <h3 className="font-semibold text-sm leading-tight">{challenge.name}</h3>
                                            <p className="text-xs text-muted-foreground line-clamp-1">{challenge.description}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                <div className="flex items-center gap-1"><Users className="w-3 h-3" /> <span>{challenge.participantCount}/{challenge.maxParticipants}</span></div>
                                                <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> <span>{differenceInCalendarDays(challenge.dates.to, challenge.dates.from)} days</span></div>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm"
                                            className="w-full h-7 mt-1 text-xs"
                                            disabled={isJoining === challenge.id || (isFull && !hasJoined) || (challengeEnded && !hasJoined)}
                                            onClick={() => handleJoinChallenge(challenge.id)}
                                        >
                                            {isJoining === challenge.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {buttonText}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                 ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>No New Challenges</CardTitle>
                            <CardDescription>There are no new challenges available to join right now.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center text-muted-foreground p-12">
                                <p className="font-semibold text-lg">Stay Tuned!</p>
                                <p className="text-sm">Our coaches are busy crafting the next magnificent challenge.</p>
                            </div>
                        </CardContent>
                    </Card>
                 )}
            </div>

        </div>
         {selectedChallenge && (
            <ClientChallengeDetailModal 
                challenge={selectedChallenge}
                isOpen={!!selectedChallenge}
                onClose={() => setSelectedChallenge(null)}
            />
        )}
        <UpgradeModal
            isOpen={isUpgradeModalOpen}
            onClose={() => setIsUpgradeModalOpen(false)}
            requiredTier="premium"
            featureName="Community Challenges"
            reason="Community builds pillar synergy for motivation!"
        />
        </>
    );
}
