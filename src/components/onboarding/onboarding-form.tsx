
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
import { Loader2, ArrowLeft, ArrowRight, Check, Star, Gem, Award, ShieldOff } from 'lucide-react';
import { Progress } from '../ui/progress';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TIER_ACCESS, UserTier } from '@/types';
import { Label } from '@/components/ui/label';
import { Switch } from '../ui/switch';
import { AppNumberInput } from '../ui/number-input';

const onboardingSchema = z.object({
    // Step 1: Account
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    fullName: z.string().min(2, "Please enter your full name."),
    
    // Step 2: Biometrics
    birthdate: z.string().refine((val) => {
        const today = new Date();
        const birthDate = new Date(val);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 18;
    }, { message: "You must be at least 18 years old." }),
    sex: z.enum(['male', 'female', 'unspecified']),
    units: z.enum(['imperial', 'metric']),
    height: z.coerce.number().positive(),
    weight: z.coerce.number().positive(),
    waist: z.coerce.number().positive(),
    zipCode: z.string().regex(/^\d{5}$/, "Please enter a valid 5-digit zip code."),

    // Step 3: Lifestyle
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
    wakeTime: z.string(),
    sleepTime: z.string(),

    // Step 4: Plan Selection
    tier: z.enum(TIER_ACCESS),
    billingCycle: z.enum(['monthly', 'yearly']),
    
    // Step 5: Final
    disclaimer: z.boolean().refine(val => val === true, { message: "You must accept the disclaimer." }),
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;

interface OnboardingFormProps {
    onFormSubmit: (data: OnboardingValues) => Promise<{success: boolean, error?: any}>;
}

const tierDetails: Record<UserTier, { name: string; price: string; yearPrice: string; features: string[], icon: React.ElementType, cta: string, highlight?: boolean }> = {
    free: { name: "Free", price: "$0", yearPrice: "$0", features: ["Core Pillar Tracking (Nutrition, Activity, Sleep, Hydration)", "Limited Insights", "Ad-Supported"], icon: Star, cta: "Start for Free" },
    'ad-free': { name: "Ad-Free", price: "$1.99/mo", yearPrice: "$19.99/yr", features: ["Everything in Free", "Ad-Free Experience"], icon: ShieldOff, cta: "Go Ad-Free" },
    basic: { name: "Basic", price: "$4.99/mo", yearPrice: "$49.99/yr", features: ["Everything in Ad-Free", "Full Biometric & Habit Tracking", "75/20/20 Protocol & Planner Tools", "Personalized Insights & Trends"], icon: Star, cta: "Choose Basic" },
    premium: { name: "Premium", price: "$7.99/mo", yearPrice: "$79.99/yr", features: ["Everything in Basic", "Community Challenges", "Group Messaging"], icon: Gem, cta: "Go Premium", highlight: true },
    coaching: { name: "Coaching", price: "$199.99/mo", yearPrice: "", features: ["Everything in Premium", "1-on-1 Human Coaching", "Personalized Meal & Activity Plans", "Priority Support"], icon: Award, cta: "Start Coaching" }
};


export function OnboardingForm({ onFormSubmit }: OnboardingFormProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    
    const form = useForm<OnboardingValues>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: {
            email: "",
            password: "",
            fullName: "",
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
            tier: 'free',
            billingCycle: 'monthly',
            disclaimer: false,
        },
    });

    const totalSteps = 5;
    const progress = (step / totalSteps) * 100;

    const nextStep = async () => {
        window.scrollTo(0, 0);
        let fieldsToValidate: (keyof OnboardingValues)[] = [];
        if (step === 1) fieldsToValidate = ['email', 'password', 'fullName'];
        if (step === 2) fieldsToValidate = ['birthdate', 'sex', 'units', 'height', 'weight', 'waist', 'zipCode'];
        if (step === 3) fieldsToValidate = ['activityLevel', 'wakeTime', 'sleepTime'];
        if (step === 4) fieldsToValidate = ['tier', 'billingCycle'];
        
        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) {
            setStep(s => s + 1);
        }
    };
    const prevStep = () => {
        window.scrollTo(0, 0);
        setStep(s => s - 1);
    }

    async function onSubmit(values: OnboardingValues) {
        setIsLoading(true);
        const { success, error } = await onFormSubmit({...values, billingCycle});
        if (success) {
            toast({ title: "Account Created!", description: "Welcome to Hunger Free and Happy!" });
        } else {
             toast({
                variant: "destructive",
                title: "Sign Up Failed",
                description: error.message || "An unexpected error occurred.",
            });
        }
        setIsLoading(false);
    }
    
    const selectedTier = form.watch('tier');

    return (
    <Card className="w-full shadow-none border-none">
        <CardHeader className="pt-2">
             <CardTitle className="text-xl text-center">
                {step === 4 ? "Choose Your Plan" : "Create Your Account"}
            </CardTitle>
            {step !== 4 && <CardDescription className="text-center">Join us on the path to being hunger-free and happy. (Step {step} of {totalSteps})</CardDescription>}
            <Progress value={progress} className="mt-2" />
        </CardHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="space-y-3">
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in">
                            <h3 className="font-semibold text-lg">Account Details</h3>
                             <FormField
                                control={form.control}
                                name="fullName"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Full Name</FormLabel>
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
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="you@example.com" {...field} />
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
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="••••••••" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}
                    {step === 2 && (
                         <div className="space-y-4 animate-in fade-in">
                             <h3 className="font-semibold text-lg">Your Metrics</h3>
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
                            <h3 className="font-semibold text-lg">Your Lifestyle</h3>
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
                    {step === 4 && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="flex items-center justify-center space-x-2">
                                <Label htmlFor="billing-cycle">Bill Monthly</Label>
                                <Switch
                                    id="billing-cycle"
                                    checked={billingCycle === 'yearly'}
                                    onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
                                />
                                <Label htmlFor="billing-cycle">Bill Yearly</Label>
                            </div>
                            <FormField
                                control={form.control}
                                name="tier"
                                render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                    <RadioGroup
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        className="grid md:grid-cols-2 gap-2"
                                    >
                                        {(Object.keys(tierDetails) as UserTier[]).map((tier) => {
                                            const details = tierDetails[tier];
                                            const Icon = details.icon;
                                            const isYearly = billingCycle === 'yearly';
                                            const price = (isYearly && details.yearPrice) ? details.yearPrice : details.price;
                                            const hasYearlyOption = details.yearPrice && tier !== 'free';

                                            return (
                                            <FormItem key={tier}>
                                                <RadioGroupItem value={tier} id={tier} className="sr-only" />
                                                <Label
                                                htmlFor={tier}
                                                className={cn(
                                                    "flex flex-col p-2 border-2 rounded-lg cursor-pointer transition-all h-full",
                                                    selectedTier === tier
                                                    ? "border-primary shadow-md"
                                                    : "border-muted hover:border-muted-foreground",
                                                    details.highlight && selectedTier !== tier && "bg-primary/5"
                                                )}
                                                >
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <Icon className={cn("h-4 w-4", selectedTier === tier && "text-primary")} />
                                                        <span className="font-bold text-sm">{details.name}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-bold">
                                                          {price}
                                                        </div>
                                                        {isYearly && hasYearlyOption && (
                                                          <p className="text-xs text-muted-foreground line-through">{details.price}</p>
                                                        )}
                                                      </div>
                                                </div>

                                                <ul className="space-y-1 text-xs text-muted-foreground flex-1">
                                                    {details.features.map((feature, i) => (
                                                        <li key={i} className="flex items-start gap-1.5">
                                                            <Check className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                                                            <span>{feature}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                                </Label>
                                            </FormItem>
                                            )
                                        })}
                                    </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                    )}
                    {step === 5 && (
                        <div className="space-y-4 animate-in fade-in">
                             <h3 className="font-semibold text-lg">Disclaimer</h3>
                             <div className="p-4 border rounded-md max-h-48 overflow-y-auto bg-muted/50 text-sm">
                                <p className="mb-2">This application ("App") is intended as a tool to help you track your habits and choices. The information and guidance provided within this App are based on the principles of the "~Hunger Free and Happy" book.</p>
                                <p className="mb-2">The App is not a medical device, nor does it provide medical advice. The creators, developers, distributors, and affiliates of this App are not medical professionals and expressly disclaim all liability for any actions taken or not taken based on the content of this App. Your use of this App is solely at your own risk.</p>
                                <p>By checking this box, you acknowledge that you have read, understood, and agree to this disclaimer, releasing the App and its creators of all liability.</p>
                             </div>
                              <FormField
                                control={form.control}
                                name="disclaimer"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>
                                            I have read, understood, and agree to the disclaimer.
                                        </FormLabel>
                                        <FormMessage />
                                    </div>
                                    </FormItem>
                                )}
                                />
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
                        ): <div />}
                    </div>
                     <div>
                        {step < totalSteps && (
                            <Button type="button" onClick={nextStep}>
                                Next
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                        {step === totalSteps && (
                             <Button type="submit" disabled={isLoading || !form.watch('disclaimer')}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Account
                            </Button>
                        )}
                    </div>
                </CardFooter>
                 <div className="pb-6 text-center text-sm">
                    Already have an account?{' '}
                    <Link href="/login" className="underline">
                        Sign In
                    </Link>
                </div>
            </form>
        </Form>
    </Card>
  );
}

    

    