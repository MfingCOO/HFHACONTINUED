
'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ArrowRight, Star, Gem, Award, ShieldOff } from 'lucide-react';
import { Progress } from '../../ui/progress';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UserTier } from '@/types';
import { TIER_ACCESS } from '@/types';
import type { OnboardingValues } from '@/components/onboarding/onboarding-form';
import { AppNumberInput } from '@/components/ui/number-input';

const createClientSchema = z.object({
    // Step 1: Account
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    fullName: z.string().min(2, "Please enter client's full name."),
    tier: z.enum(TIER_ACCESS),
    
    // Step 2: Biometrics
    birthdate: z.string().refine((val) => val ? new Date(val) < new Date() : true, { message: "Birthdate must be in the past." }),
    sex: z.enum(['male', 'female', 'unspecified']),
    units: z.enum(['imperial', 'metric']),
    height: z.coerce.number({invalid_type_error: "Height is required"}).positive("Height must be a positive number"),
    weight: z.coerce.number({invalid_type_error: "Weight is required"}).positive("Weight must be a positive number"),
    waist: z.coerce.number({invalid_type_error: "Waist is required"}).positive("Waist must be a positive number"),
    zipCode: z.string().regex(/^\d{5}$/, "Please enter a valid 5-digit zip code."),

    // Step 3: Lifestyle
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
    wakeTime: z.string(),
    sleepTime: z.string(),
});

type CreateClientValues = z.infer<typeof createClientSchema>;

interface CreateClientFormProps {
    onFormSubmit: (data: CreateClientValues) => Promise<{success: boolean, error?: any}>;
    onCancel: () => void;
}

const tierDetails: Record<UserTier, { name: string; price: string; yearPrice: string; features: string[], icon: React.ElementType, cta: string, highlight?: boolean }> = {
    free: { name: "Free", price: "$0", yearPrice: "", features: ["Core Pillar Tracking (Nutrition, Activity, Sleep, Hydration)", "Limited Insights", "Ad-Supported"], icon: Star, cta: "Start for Free" },
    'ad-free': { name: "Ad-Free", price: "$1.99/mo", yearPrice: "$19.99/yr", features: ["Everything in Free", "Ad-Free Experience"], icon: ShieldOff, cta: "Go Ad-Free" },
    basic: { name: "Basic", price: "$4.99/mo", yearPrice: "$49.99/yr", features: ["Everything in Ad-Free", "Full Biometric & Habit Tracking", "75/20/20 Protocol & Planner Tools", "Personalized Insights & Trends"], icon: Star, cta: "Choose Basic" },
    premium: { name: "Premium", price: "$7.99/mo", yearPrice: "$79.99/yr", features: ["Everything in Basic", "Community Challenges", "Group Messaging"], icon: Gem, cta: "Go Premium", highlight: true },
    coaching: { name: "Coaching", price: "$199.99/mo", yearPrice: "", features: ["Everything in Premium", "1-on-1 Human Coaching", "Personalized Meal & Activity Plans", "Priority Support"], icon: Award, cta: "Start Coaching" }
};


export function CreateClientForm({ onFormSubmit, onCancel }: CreateClientFormProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    
    const form = useForm<CreateClientValues>({
        resolver: zodResolver(createClientSchema),
        defaultValues: {
            email: "",
            password: "",
            fullName: "",
            tier: 'basic',
            birthdate: "",
            sex: "unspecified",
            units: 'imperial',
            height: 0,
            weight: 0,
            waist: 0,
            zipCode: "",
            activityLevel: 'light',
            wakeTime: "07:00",
            sleepTime: "22:00",
        },
    });

    const totalSteps = 3;
    const progress = (step / totalSteps) * 100;

    const nextStep = async () => {
        let fieldsToValidate: (keyof CreateClientValues)[] = [];
        if (step === 1) fieldsToValidate = ['email', 'password', 'fullName', 'tier'];
        if (step === 2) fieldsToValidate = ['birthdate', 'sex', 'units', 'height', 'weight', 'waist', 'zipCode'];
        
        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) {
            setStep(s => s + 1);
        }
    };
    const prevStep = () => setStep(s => s - 1);

    async function onSubmit(values: CreateClientValues) {
        setIsLoading(true);
        await onFormSubmit(values);
        setIsLoading(false);
    }

    return (
    <Card className="w-full shadow-none border-none">
        <CardHeader>
            <CardTitle className="text-2xl text-center">Onboard New Client</CardTitle>
            <CardDescription className="text-center">Complete the client's profile. (Step {step} of {totalSteps})</CardDescription>
            <Progress value={progress} className="mt-4" />
        </CardHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="space-y-6">
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in">
                            <h3 className="font-semibold text-lg">Account Details</h3>
                             <FormField
                                control={form.control}
                                name="fullName"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Client's Full Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Jane Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Client's Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="client@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Temporary Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="••••••••" {...field} />
                                    </FormControl>
                                     <FormDescription>The client will be prompted to change this on first login.</FormDescription>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="tier"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Assign Tier</FormLabel>
                                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a tier for the client" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {TIER_ACCESS.map(tier => {
                                                    const Icon = tierDetails[tier]?.icon || Star;
                                                    return (
                                                        <SelectItem key={tier} value={tier}>
                                                            <div className="flex items-center gap-2">
                                                                <Icon className="h-4 w-4" />
                                                                <span className="capitalize">{tier}</span>
                                                            </div>
                                                        </SelectItem>
                                                    )
                                                })}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            Selecting 'Coaching' will automatically create a private chat.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                        </div>
                    )}
                    {step === 2 && (
                         <div className="space-y-4 animate-in fade-in">
                             <h3 className="font-semibold text-lg">Client's Metrics</h3>
                             <FormField
                                control={form.control}
                                name="birthdate"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Birthdate</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="sex"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                    <FormLabel>Sex</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        className="flex space-x-4"
                                        >
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="male" /></FormControl>
                                            <FormLabel className="font-normal">Male</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="female" /></FormControl>
                                            <FormLabel className="font-normal">Female</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="unspecified" /></FormControl>
                                            <FormLabel className="font-normal">Prefer not to say</FormLabel>
                                        </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="height"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Height ({form.watch('units') === 'imperial' ? 'in' : 'cm'})</FormLabel>
                                        <FormControl>
                                            <AppNumberInput {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="weight"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Weight ({form.watch('units') === 'imperial' ? 'lbs' : 'kg'})</FormLabel>
                                        <FormControl>
                                            <AppNumberInput {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name="waist"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Waist ({form.watch('units') === 'imperial' ? 'in' : 'cm'})</FormLabel>
                                        <FormControl>
                                            <AppNumberInput {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="units"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                        <FormLabel>Units of Measure</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex space-x-4"
                                            >
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl>
                                                <RadioGroupItem value="imperial" />
                                                </FormControl>
                                                <FormLabel className="font-normal">Imperial</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl>
                                                <RadioGroupItem value="metric" />
                                                </FormControl>
                                                <FormLabel className="font-normal">Metric</FormLabel>
                                            </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="zipCode"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Zip Code</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., 90210" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    )}
                    {step === 3 && (
                         <div className="space-y-4 animate-in fade-in">
                            <h3 className="font-semibold text-lg">Client's Lifestyle</h3>
                             <FormField
                                control={form.control}
                                name="activityLevel"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                    <FormLabel>Approximate Activity Level</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        className="flex flex-col space-y-1"
                                        >
                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl><RadioGroupItem value="sedentary" /></FormControl>
                                                <FormLabel className="font-normal">Sedentary (little or no exercise)</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl><RadioGroupItem value="light" /></FormControl>
                                                <FormLabel className="font-normal">Lightly active (light exercise/sports 1-3 days/week)</FormLabel>
                                            </FormItem>
                                             <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl><RadioGroupItem value="moderate" /></FormControl>
                                                <FormLabel className="font-normal">Moderately active (moderate exercise/sports 3-5 days/week)</FormLabel>
                                            </FormItem>
                                             <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl><RadioGroupItem value="active" /></FormControl>
                                                <FormLabel className="font-normal">Very active (hard exercise/sports 6-7 days a week)</FormLabel>
                                            </FormItem>
                                             <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl><RadioGroupItem value="very_active" /></FormControl>
                                                <FormLabel className="font-normal">Extra active (very hard exercise/sports & physical job)</FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                     <FormField
                                        control={form.control}
                                        name="wakeTime"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Approx. Wake Up Time</FormLabel>
                                            <FormControl>
                                                <Input type="time" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                     <FormField
                                        control={form.control}
                                        name="sleepTime"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Approx. Bedtime</FormLabel>
                                            <FormControl>
                                                <Input type="time" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                         </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between">
                    <div>
                        {step > 1 ? (
                             <Button type="button" variant="ghost" onClick={prevStep}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Previous
                            </Button>
                        ): (
                            <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                        )}
                    </div>
                     <div>
                        {step < totalSteps && (
                            <Button type="button" onClick={nextStep}>
                                Next
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                        {step === totalSteps && (
                             <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Client Account
                            </Button>
                        )}
                    </div>
                </CardFooter>
            </form>
        </Form>
    </Card>
  );
}
