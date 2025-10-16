
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage, FormDescription } from '@/components/ui/form';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getSiteSettingsAction, updateSiteSettingsAction } from '@/app/coach/site-settings/actions';
import { updateCoachEmailAction, updateUserPasswordAction } from '@/app/coach/actions';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/auth/auth-provider';
import { Separator } from '@/components/ui/separator';
import { signOut } from 'firebase/auth';
import { auth as clientAuth } from '@/lib/firebase';
import { ScrollArea } from '@/components/ui/scroll-area';

const siteSettingsSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL." }).or(z.literal('')),
  videoCallLink: z.string().url({ message: "Please enter a valid URL." }).or(z.literal('')),
  aiModelSettings: z.object({
      pro: z.string().optional(),
      flash: z.string().optional(),
  }).optional(),
});

const emailSchema = z.object({
  email: z.string().email(),
});
const passwordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
});


interface ManageSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageSettingsDialog({ open, onOpenChange }: ManageSettingsDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const siteSettingsForm = useForm<z.infer<typeof siteSettingsSchema>>({
    resolver: zodResolver(siteSettingsSchema),
    defaultValues: {
        url: '', 
        videoCallLink: '',
        aiModelSettings: {
            pro: 'gemini-2.5-pro',
            flash: 'gemini-2.5-flash',
        }
    },
  });

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: user?.email || '' },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      getSiteSettingsAction().then(result => {
        if (result.success && result.data) {
          siteSettingsForm.setValue('url', result.data.url);
          siteSettingsForm.setValue('videoCallLink', result.data.videoCallLink || '');
           siteSettingsForm.setValue('aiModelSettings.pro', result.data.aiModelSettings?.pro || 'gemini-2.5-pro');
           siteSettingsForm.setValue('aiModelSettings.flash', result.data.aiModelSettings?.flash || 'gemini-2.5-flash');
        }
      });
      emailForm.setValue('email', user?.email || '');
      setIsLoading(false);
    }
  }, [open, user, siteSettingsForm, emailForm]);

  const onUpdateSiteSettings = async (data: z.infer<typeof siteSettingsSchema>) => {
    const result = await updateSiteSettingsAction(data);
    if (result.success) {
      toast({ title: 'Success!', description: 'Site settings have been updated.' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to update settings.' });
    }
  };

  const onUpdateEmail = async (data: z.infer<typeof emailSchema>) => {
    if (!user) return;
    const result = await updateCoachEmailAction(user.uid, data.email);
    if (result.success) {
      toast({ title: 'Email Updated!', description: 'Your email has been successfully updated.' });
    } else {
       toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to update email.' });
    }
  }

  const onUpdatePassword = async (data: z.infer<typeof passwordSchema>) => {
     if (!user) return;
    const result = await updateUserPasswordAction(user.uid, data.newPassword);
    if (result.success) {
      toast({ title: 'Password Updated!', description: 'Your password has been changed. Please log in again.' });
      await signOut(clientAuth);
      onOpenChange(false);
    } else {
       toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to update password.' });
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-4xl flex flex-col max-h-[85dvh]">
        <DialogHeader>
          <DialogTitle srOnly>Settings</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0">
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
            <Tabs defaultValue="account" className="w-full h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="account">My Account</TabsTrigger>
                <TabsTrigger value="site">Site Settings</TabsTrigger>
              </TabsList>
              
              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="py-4">
                    <TabsContent value="account" className="mt-0">
                      <Card>
                          <CardHeader><CardTitle>Account Information</CardTitle><CardDescription>Update your login credentials.</CardDescription></CardHeader>
                          <CardContent className="space-y-4">
                              <Form {...emailForm}>
                                  <form onSubmit={emailForm.handleSubmit(onUpdateEmail)} className="space-y-3">
                                      <FormField control={emailForm.control} name="email" render={({ field }) => (
                                          <FormItem><Label>Email Address</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                      )} />
                                      <Button type="submit" size="sm" disabled={emailForm.formState.isSubmitting}>
                                          {emailForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                          Update Email
                                      </Button>
                                  </form>
                              </Form>
                              <Separator className="my-3"/>
                                <Form {...passwordForm}>
                                  <form onSubmit={passwordForm.handleSubmit(onUpdatePassword)} className="space-y-3">
                                      <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                                          <FormItem><Label>New Password</Label><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                                      )} />
                                      <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                                          <FormItem><Label>Confirm New Password</Label><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                                      )} />
                                      <Button type="submit" size="sm" disabled={passwordForm.formState.isSubmitting}>
                                          {passwordForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                          Update Password
                                      </Button>
                                  </form>
                              </Form>
                          </CardContent>
                      </Card>
                    </TabsContent>
                    
                    <TabsContent value="site" className="mt-0">
                      <Card>
                          <CardHeader><CardTitle>Global Site Settings</CardTitle><CardDescription>Set global links for the application.</CardDescription></CardHeader>
                          <CardContent>
                              <Form {...siteSettingsForm}>
                                  <form onSubmit={siteSettingsForm.handleSubmit(onUpdateSiteSettings)} className="space-y-4">
                                      <FormField control={siteSettingsForm.control} name="url" render={({ field }) => (
                                          <FormItem><FormLabel>Website URL</FormLabel><FormDescription>Set the primary URL that the header logo will link to.</FormDescription><FormControl><Input placeholder="https://hungerfreeandhappy.com" {...field} /></FormControl><FormMessage /></FormItem>
                                      )} />
                                       <FormField control={siteSettingsForm.control} name="videoCallLink" render={({ field }) => (
                                          <FormItem><FormLabel>Default Video Call Link</FormLabel><FormDescription>This link will be automatically attached to new appointments.</FormDescription><FormControl><Input placeholder="https://zoom.us/j/1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                                      )} />
                                      <Button type="submit" size="sm" disabled={siteSettingsForm.formState.isSubmitting}>
                                          {siteSettingsForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                          Save Settings
                                      </Button>
                                  </form>
                              </Form>
                          </CardContent>
                      </Card>
                    </TabsContent>
                  </div>
                </ScrollArea>
              </div>
            </Tabs>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
