import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/icons/logo";
import Link from 'next/link';

export default function LoginPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
             <div className="flex items-center gap-2 mb-8">
                <Logo className="w-8 h-8 text-primary" />
                <h1 className="text-2xl font-semibold">Hunger-Free and Happy</h1>
            </div>
            <LoginForm />
            <div className="mt-4 text-center text-xs text-muted-foreground max-w-md">
                View our{' '}
                <Link href="/tos" className="underline hover:text-primary">
                    Terms of Service
                </Link>
                ,{' '}
                <Link href="/privacy" className="underline hover:text-primary">
                    Privacy Policy
                </Link>
                , or contact{' '}
                <Link href="/support" className="underline hover:text-primary">
                    Support
                </Link>
                .
            </div>
        </div>
    )
}
