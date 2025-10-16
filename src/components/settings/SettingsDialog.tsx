
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, User, Bell, SlidersHorizontal, Settings as SettingsIcon, CreditCard, LogOut, Trash2, Camera, Target, Undo2, BrainCircuit, RefreshCw, HelpCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/components/auth/auth-provider';
import { signOut } from 'firebase/auth';
import { auth as clientAuth } from '@/lib/firebase';
import {
  updateUserProfileAction,
  updateUserPasswordAction,
  updateClientProfileAndGoalsAction,
  updateClientSettingsAction,
  createStripePortalSession
} from '@/app/client/settings/actions';
import { getSiteSettingsAction, updateSiteSettingsAction } from '@/app/coach/site-settings/actions';
import type { TrackingSettings, ClientProfile, NutritionalGoals } from '@/types';
import { Switch } from '../ui/switch';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getClientByIdAction } from '@/app/coach/clients/actions';
import { calculateNutritionalGoals, AllGoalSets } from '@/services/goals';
import { AppNumberInput } from '../ui/number-input';
import { Slider } from '../ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import Link from 'next/link';


interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
  defaultAccordion?: string;
}

const accountSchema = z.object({
    fullName: z.string().min(2, "Name is too short."),
    email: z.string().email("Invalid email address."),
    phone: z.string().optional(),
});

const passwordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
});

const goalsSchema = z.object({
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  calculationMode: z.enum(['ideal', 'actual', 'custom']),
  calorieModifier: z.coerce.number(),
  customMacros: z.object({
    protein: z.coerce.number().positive("Must be > 0").optional().or(z.literal('')),
    fat: z.coerce.number().positive("Must be > 0").optional().or(z.literal('')),
    carbs: z.coerce.number().nonnegative("Cannot be negative").optional().or(z.literal(0)).or(z.literal('')),
  })
});

const siteSettingsSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL." }).or(z.literal('')),
  videoCallLink: z.string().url({ message: "Please enter a valid URL." }).or(z.literal('')),
  aiModelSettings: z.object({
      pro: z.string().optional(),
      flash: z.string().optional(),
  }).optional(),
});


const trackingOptions: { id: keyof Omit<TrackingSettings, 'units' | 'reminders'>, label: string }[] = [
    { id: 'nutrition', label: 'Nutrition Tracking' },
    { id: 'hydration', label: 'Hydration Tracking' },
    { id: 'activity', label: 'Activity Tracking' },
    { id: 'sleep', label: 'Sleep Tracking' },
    { id: 'stress', label: 'Stress/Cravings Tracking' },
    { id: 'measurements', label: 'Measurements Tracking' },
];

export function SettingsDialog({ open, onOpenChange, defaultTab, defaultAccordion }: SettingsDialogProps) {
  const { toast } = useToast();
  const { user, isCoach } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState<Partial<TrackingSettings>>({});
  const [clientData, setClientData] = useState<ClientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [displayGoals, setDisplayGoals] = useState<AllGoalSets | null>(null);
  
  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { fullName: '', email: '', phone: '' },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
  });

   const goalsForm = useForm<z.infer<typeof goalsSchema>>({
    resolver: zodResolver(goalsSchema),
    defaultValues: {
      activityLevel: 'light',
      calculationMode: 'ideal',
      calorieModifier: 0,
      customMacros: { protein: '', fat: '', carbs: '' },
    },
  });

  const siteSettingsForm = useForm<z.infer<typeof siteSettingsSchema>>({
    resolver: zodResolver(siteSettingsSchema),
    defaultValues: { 
        url: '', 
        videoCallLink: '',
        aiModelSettings: {
            pro: '',
            flash: '',
        }
    },
  });

  const watchedGoals = useWatch({ control: goalsForm.control });

    useEffect(() => {
        if (!clientData || !clientData.onboarding || !watchedGoals) {
            return;
        }

        const tempProfileForCalc: ClientProfile = {
            ...clientData,
            customGoals: {
                ...clientData.customGoals,
                activityLevel: watchedGoals.activityLevel,
                calculationMode: watchedGoals.calculationMode,
                calorieModifier: watchedGoals.calorieModifier,
                protein: typeof watchedGoals.customMacros?.protein === 'number' ? watchedGoals.customMacros.protein : undefined,
                fat: typeof watchedGoals.customMacros?.fat === 'number' ? watchedGoals.customMacros.fat : undefined,
                carbs: watchedGoals.customMacros?.carbs === '' ? undefined : (typeof watchedGoals.customMacros?.carbs === 'number' ? watchedGoals.customMacros.carbs : undefined),
            },
        };
        
        const calculated = calculateNutritionalGoals(tempProfileForCalc);
        setDisplayGoals(calculated);

    }, [clientData, watchedGoals]);
  
  const fetchClientData = useCallback(async () => {
    if (!user || isCoach) return;
    setIsLoading(true);
    try {
        const result = await getClientByIdAction(user.uid);
        if (result.success && result.data) {
            const data = result.data;
            setClientData(data);
            accountForm.reset({ fullName: data.fullName || '', email: data.email || '' });
             setSettings(data.trackingSettings || {});
            
            goalsForm.reset({
              activityLevel: data.customGoals?.activityLevel || data.onboarding?.activityLevel || 'light',
              calculationMode: data.customGoals?.calculationMode || 'ideal',
              calorieModifier: data.customGoals?.calorieModifier || 0,
              customMacros: {
                protein: data.customGoals?.protein || '',
                fat: data.customGoals?.fat || '',
                carbs: data.customGoals?.carbs ?? '', 
              }
            });
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load your profile.' });
    } finally {
        setIsLoading(false);
    }
  }, [user, isCoach, accountForm, goalsForm, toast]);


  useEffect(() => {
    if (open && user) {
      if (isCoach) {
        setIsLoading(true);
        getSiteSettingsAction().then(result => {
          if (result.success && result.data) {
            siteSettingsForm.reset({
              url: result.data.url || '',
              videoCallLink: result.data.videoCallLink || '',
              aiModelSettings: {
                pro: result.data.aiModelSettings?.pro || 'googleai/gemini-2.5-pro-latest',
                flash: result.data.aiModelSettings?.flash || 'googleai/gemini-2.5-flash-latest',
              }
            });
          }
        });
        accountForm.reset({ fullName: user.displayName || '', email: user.email || '' });
        setIsLoading(false);
      } else {
        fetchClientData();
      }
    }
  }, [user, open, isCoach, accountForm, siteSettingsForm, fetchClientData]);


  const onUpdateAccount = async (data: z.infer<typeof accountSchema>) => {
    if (!user) return;
    setIsSaving(true);
    const result = await updateUserProfileAction(user.uid, data);
    if (result.success) {
      toast({ title: 'Account Updated' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsSaving(false);
  };
  
  const onUpdatePassword = async (data: z.infer<typeof passwordSchema>) => {
     if (!user) return;
    setIsSaving(true);
    const result = await updateUserPasswordAction(user.uid, data.newPassword);
     if (result.success) {
      toast({ title: 'Password Updated!', description: 'Please log in again with your new password.' });
      await signOut(clientAuth);
      onOpenChange(false);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsSaving(false);
  };
  
   const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const dataUrl = reader.result as string;
            setIsSaving(true);
            const result = await updateUserProfileAction(user.uid, { photoURL: dataUrl });
            if(result.success) {
                toast({ title: "Profile picture updated!" });
                await user.reload(); 
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
            setIsSaving(false);
        };
        reader.readAsDataURL(file);
    }
  };
  
  const handleSettingChange = async (key: keyof TrackingSettings, value: any) => {
    if (!user) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings); 

    const result = await updateClientSettingsAction(user.uid, { [key]: value });
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: "Could not save your preferences."});
      setSettings(prev => ({...prev, [key]: !value })); 
    }

    if (value === false) {
        localStorage.removeItem(`hasSeen_${key}`);
    }
  };

  const onUpdateGoals = async (data: z.infer<typeof goalsSchema>) => {
    if(!user) return;
    setIsSaving(true);
    try {
        const result = await updateClientProfileAndGoalsAction(user.uid, data);
        if(result.success) {
          toast({ title: "Goals Updated!", description: "Your nutritional targets have been saved." });
          await fetchClientData();
        } else {
          throw new Error(result.error || "An unknown error occurred.");
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

  const onUpdateSiteSettings = async (data: z.infer<typeof siteSettingsSchema>) => {
    setIsSaving(true);
    const result = await updateSiteSettingsAction(data);
    if (result.success) {
      toast({ title: 'Success!', description: 'Site settings have been updated.' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to update settings.' });
    }
    setIsSaving(false);
  };
  
  const handleLogout = async () => {
    await signOut(clientAuth);
    onOpenChange(false);
    toast({ title: "Logged Out" });
  }

  const handleManageBilling = async () => {
    if (!user) return;
    setIsSaving(true);
    const { url, error } = await createStripePortalSession(user.uid);
    if (url) {
        window.location.href = url;
    } else {
        toast({ variant: 'destructive', title: 'Error', description: error || "Could not open billing portal." });
    }
    setIsSaving(false);
  }

  const calculationMode = watchedGoals.calculationMode;
  
  const goalsToShow = 
    calculationMode === 'ideal' ? displayGoals?.idealGoals :
    calculationMode === 'actual' ? displayGoals?.actualGoals :
    displayGoals?.customGoals;
  
  const tdee = displayGoals?.actualGoals.tdee;


  const renderAccountTabContent = () => (
    <div className="space-y-4">
        <div className="flex items-center gap-4">
            <div className="relative">
                <Avatar className="h-20 w-20 border-2 border-primary">
                    <AvatarImage src={user?.photoURL || ''} />
                    <AvatarFallback className="text-3xl">{clientData?.fullName?.charAt(0) || user?.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*"/>
                <Button size="icon" variant="secondary" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full border-2 border-background" onClick={() => fileInputRef.current?.click()}>
                    <Camera className="h-4 w-4"/>
                </Button>
            </div>
            <div className="flex-1">
                <Form {...accountForm}>
                    <form id="account-form" onSubmit={accountForm.handleSubmit(onUpdateAccount)} className="space-y-3">
                        <FormField control={accountForm.control} name="fullName" render={({ field }) => (
                            <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={accountForm.control} name="email" render={({ field }) => (
                            <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </form>
                </Form>
            </div>
        </div>
        <Button type="submit" form="account-form" size="sm" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
            Update Profile
        </Button>
        <Separator className="my-3"/>
        <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onUpdatePassword)} className="space-y-3">
                <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                    <FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                    <FormItem><FormLabel>Confirm New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" size="sm" variant="secondary" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Update Password
                </Button>
            </form>
        </Form>
        <Separator className="my-3"/>
        <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full" asChild>
                <Link href="/support"><HelpCircle className="mr-2"/> Help & Support</Link>
            </Button>
            <Button variant="outline" className="w-full" onClick={handleLogout}><LogOut className="mr-2"/> Log Out</Button>
        </div>
    </div>
  );

  const renderCoachSettings = () => (
    <Tabs defaultValue={defaultTab || "account"} className="w-full h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="account">My Account</TabsTrigger>
            <TabsTrigger value="site">Site Settings</TabsTrigger>
        </TabsList>
        <div className="flex-1 min-h-0 py-4">
            <TabsContent value="account" className="mt-0">
                {renderAccountTabContent()}
            </TabsContent>
            <TabsContent value="site" className="mt-0 space-y-4">
                <Form {...siteSettingsForm}>
                    <form id="site-settings-form" onSubmit={siteSettingsForm.handleSubmit(onUpdateSiteSettings)} className="space-y-2">
                         <Card>
                            <CardHeader className="p-4">
                                <CardTitle>Global Site Settings</CardTitle>
                                <CardDescription>Set global links for the application.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-3">
                                <FormField control={siteSettingsForm.control} name="url" render={({ field }) => (
                                    <FormItem><FormLabel>Website URL</FormLabel><FormControl><Input placeholder="https://hungerfreeandhappy.com" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={siteSettingsForm.control} name="videoCallLink" render={({ field }) => (
                                <FormItem><FormLabel>Default Video Call Link</FormLabel><FormControl><Input placeholder="https://zoom.us/j/1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="p-4">
                                <CardTitle className="flex items-center gap-2"><BrainCircuit /> AI Model Configuration</CardTitle>
                                <CardDescription>Define which Google AI models the app should use for various tasks.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-3">
                                <FormField control={siteSettingsForm.control} name="aiModelSettings.pro" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Pro Model Name</FormLabel>
                                        <FormControl><Input {...field} placeholder="e.g., gemini-1.5-pro-latest" /></FormControl>
                                        <FormDescription className="text-xs">Used for complex reasoning and insights.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={siteSettingsForm.control} name="aiModelSettings.flash" render={({ field }) => (
                                <FormItem>
                                     <FormLabel>Flash Model Name</FormLabel>
                                     <FormControl><Input {...field} placeholder="e.g., gemini-1.5-flash-latest" /></FormControl>
                                     <FormDescription className="text-xs">Used for faster, simpler tasks.</FormDescription>
                                     <FormMessage />
                                </FormItem>
                                )} />
                            </CardContent>
                        </Card>
                    </form>
                </Form>
                 <Button type="submit" form="site-settings-form" size="sm" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Save All Site Settings
                </Button>
            </TabsContent>
        </div>
    </Tabs>
  );
  
  const renderClientSettings = () => (
    <Tabs defaultValue={defaultTab || "account"} className="w-full h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="account">My Account</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>
         <div className="flex-1 min-h-0 py-4">
            <TabsContent value="account" className="mt-0">
                <Accordion type="single" collapsible className="w-full space-y-2" defaultValue={defaultAccordion || "goals"}>
                    <AccordionItem value="goals" className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-3 py-2 hover:no-underline bg-muted/30">
                            <div className="flex items-center gap-2">
                                <Target className="h-5 w-5" />
                                <h3 className="font-semibold text-base">Goals</h3>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-3 space-y-2">
                           <Form {...goalsForm}>
                            <form id="goals-form" onSubmit={goalsForm.handleSubmit(onUpdateGoals)} className="space-y-3">
                                <FormField control={goalsForm.control} name="calculationMode" render={({ field }) => (
                                    <FormItem><FormLabel>Calculation Mode</FormLabel>
                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-3 gap-1">
                                            <FormItem><Label htmlFor="ideal" className={cn("flex text-xs h-9 items-center justify-center rounded-md border-2 border-muted bg-popover p-1 hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === 'ideal' && "border-primary")}><FormControl><RadioGroupItem value="ideal" id="ideal" className="sr-only" /></FormControl>Ideal</Label></FormItem>
                                            <FormItem><Label htmlFor="actual" className={cn("flex text-xs h-9 items-center justify-center rounded-md border-2 border-muted bg-popover p-1 hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === 'actual' && "border-primary")}><FormControl><RadioGroupItem value="actual" id="actual" className="sr-only" /></FormControl>Actual</Label></FormItem>
                                            <FormItem><Label htmlFor="custom" className={cn("flex text-xs h-9 items-center justify-center rounded-md border-2 border-muted bg-popover p-1 hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === 'custom' && "border-primary")}><FormControl><RadioGroupItem value="custom" id="custom" className="sr-only" /></FormControl>Custom</Label></FormItem>
                                        </RadioGroup><FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={goalsForm.control} name="activityLevel" render={({ field }) => (
                                  <FormItem><FormLabel>Activity Level</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="sedentary">Sedentary</SelectItem>
                                        <SelectItem value="light">Lightly Active</SelectItem>
                                        <SelectItem value="moderate">Moderately Active</SelectItem>
                                        <SelectItem value="active">Very Active</SelectItem>
                                        <SelectItem value="very_active">Extra Active</SelectItem>
                                      </SelectContent>
                                    </Select><FormMessage />
                                  </FormItem>
                                )}/>

                                <div className="p-1 rounded-md bg-muted/50 text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Est. Maintenance Calories (TDEE)</p>
                                    <p className="text-base font-bold">{tdee?.toLocaleString()}</p>
                                </div>

                                {calculationMode === 'actual' && (
                                    <FormField control={goalsForm.control} name="calorieModifier" render={({ field }) => (
                                        <FormItem><div className="flex justify-between items-baseline"><FormLabel className="text-xs">Calorie Adjustment</FormLabel><span className={cn("font-bold text-sm", field.value < 0 ? 'text-red-400' : 'text-green-400')}>{field.value > 0 ? '+' : ''}{field.value}</span></div>
                                            <FormControl><Slider value={[field.value]} onValueChange={(v) => field.onChange(v[0])} min={-1000} max={1000} step={50} /></FormControl>
                                        </FormItem>
                                    )}/>
                                )}
                                
                                <div className="grid grid-cols-2 gap-2 items-center">
                                   <div className="p-1 rounded-md bg-muted/50 text-center h-full">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Daily Calorie Goal</p>
                                        <p className="font-bold text-base">{Math.round(goalsToShow?.calorieGoal || 0).toLocaleString()}</p>
                                    </div>
                                     <div className="p-1 rounded-md bg-muted/50 text-center h-full">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Goal Range</p>
                                        <p className="font-bold text-base">{Math.round(goalsToShow?.calorieGoalRange?.min || 0).toLocaleString()} - {Math.round(goalsToShow?.calorieGoalRange?.max || 0).toLocaleString()}</p>
                                    </div>
                                </div>

                                {calculationMode !== 'custom' ? (
                                    <div className="pt-2">
                                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Suggested Daily Macros</h4>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="text-center"><p className="text-[10px] text-muted-foreground">Protein</p><p className="font-bold">{Math.round(goalsToShow?.protein || 0)}g</p></div>
                                            <div className="text-center"><p className="text-[10px] text-muted-foreground">Fat</p><p className="font-bold">{Math.round(goalsToShow?.fat || 0)}g</p></div>
                                            <div className="text-center">
                                                <p className="text-[10px] text-muted-foreground">Carbs</p>
                                                <p className={cn("font-bold", (goalsToShow?.carbs || 0) < 0 && "text-destructive")}>{Math.round(goalsToShow?.carbs || 0)}g</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                     <div className="pt-2">
                                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Custom Daily Macros</h4>
                                        <div className="grid grid-cols-3 gap-2 pt-1">
                                            <FormField control={goalsForm.control} name="customMacros.protein" render={({ field }) => (
                                                <FormItem><FormLabel className="text-xs">Protein (g)</FormLabel><FormControl><AppNumberInput {...field} maxLength={3} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={goalsForm.control} name="customMacros.fat" render={({ field }) => (
                                                <FormItem><FormLabel className="text-xs">Fat (g)</FormLabel><FormControl><AppNumberInput {...field} maxLength={3} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={goalsForm.control} name="customMacros.carbs" render={({ field }) => (
                                                <FormItem><FormLabel className="text-xs">Carbs (g)</FormLabel><FormControl><AppNumberInput {...field} maxLength={3} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                        </div>
                                    </div>
                                )}
                            </form>
                           </Form>
                           <Button type="submit" form="goals-form" className="w-full" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Save Goals
                           </Button>
                        </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="account" className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-3 py-2 hover:no-underline bg-muted/30">
                            <div className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                <h3 className="font-semibold text-base">Account</h3>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-3 space-y-3">
                           {renderAccountTabContent()}
                        </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="tracking" className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-3 py-2 hover:no-underline bg-muted/30">
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="h-5 w-5" />
                                <h3 className="font-semibold text-base">Tracking Preferences</h3>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                <Label htmlFor="units">Unit System</Label>
                                <RadioGroup 
                                    defaultValue={settings.units || 'imperial'} 
                                    className="flex"
                                    onValueChange={(value) => handleSettingChange('units', value)}
                                >
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="metric" id="r1" /><Label htmlFor="r1">Metric</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="imperial" id="r2" /><Label htmlFor="r2">Imperial</Label></div>
                                </RadioGroup>
                            </div>
                            {trackingOptions.map(option => (
                                 <div key={option.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                    <Label htmlFor={option.id}>{option.label}</Label>
                                    <Switch
                                        id={option.id}
                                        checked={settings[option.id] !== false}
                                        onCheckedChange={(checked) => handleSettingChange(option.id, checked)}
                                    />
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>
             <TabsContent value="subscription" className="mt-0 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Subscription & Billing</CardTitle>
                        <CardDescription>Manage your subscription and payment details through our secure portal.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleManageBilling} disabled={isSaving} className="w-full">
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Manage Billing
                        </Button>
                    </CardContent>
                </Card>
            </TabsContent>
        </div>
    </Tabs>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-lg h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your account and app preferences.</DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
                <div className="p-2 sm:p-4">
                    {isLoading ? (
                         <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : isCoach ? renderCoachSettings() : renderClientSettings()}
                </div>
            </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

    
