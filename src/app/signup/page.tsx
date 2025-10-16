'use client';
import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import { Logo } from '@/components/icons/logo';
import { useToast } from '@/hooks/use-toast';
import { unifiedSignupAction } from '@/app/coach/clients/actions';
import type { OnboardingValues } from '@/components/onboarding/onboarding-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';


export default function SignupPage() {
    const { toast } = useToast();
    const router = useRouter();

    const handleSignup = async (data: OnboardingValues) => {
        try {
            // Call the single, unified signup action for all tiers.
            const result = await unifiedSignupAction(data, data.billingCycle);

            if (result.success) {
                // If a checkout URL is returned, it's a paid plan. Redirect to Stripe.
                if (result.checkoutUrl) {
                    window.location.href = result.checkoutUrl;
                    // The user is navigating away, so we just return success.
                    return { success: true };
                } else {
                    // If no checkout URL, it was a free user. Their account is created.
                    // Redirect them to the login page.
                    toast({
                        title: "Account Created!",
                        description: "Welcome! Please log in to begin your journey.",
                    });
                    router.push('/login');
                    return { success: true };
                }
            } else {
                // Handle any backend errors (e.g., email already exists).
                throw new Error(result.error || "An unknown error occurred during sign up.");
            }
        } catch (error: any) {
            console.error("Client creation failed:", error);
            let errorMessage = error.message || "An unexpected error occurred during sign up.";
            if (errorMessage.includes('email-already-in-use') || errorMessage.includes('EMAIL_EXISTS')) {
                errorMessage = "This email address is already in use by another account.";
            }
            toast({
                variant: 'destructive',
                title: 'Sign Up Failed',
                description: errorMessage,
            });
            return { success: false, error: { message: errorMessage } };
        }
    };
    
    return (
         <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-background">
             <div className="sticky top-0 z-10 bg-background w-full flex items-center justify-center gap-2 py-2">
                <Logo className="w-8 h-8 text-primary" />
                <h1 className="text-2xl font-semibold">Hunger-Free and Happy</h1>
            </div>
            <div className="w-full max-w-2xl pt-4">
                <OnboardingForm onFormSubmit={handleSignup} />
            </div>
            <div className="mt-4 text-center text-xs text-muted-foreground max-w-lg">
                By creating an account, you agree to our{' '}
                <Link href="/tos" className="underline hover:text-primary">
                    Terms of Service
                </Link>
                {' '}and{' '}
                <Link href="/privacy" className="underline hover:text-primary">
                    Privacy Policy
                </Link>
                . For help, please contact{' '}
                <Link href="/support" className="underline hover:text-primary">
                    Support
                </Link>.
            </div>
        </main>
    )
}
