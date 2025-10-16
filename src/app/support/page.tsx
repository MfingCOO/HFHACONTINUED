
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, HelpCircle } from "lucide-react"

export default function SupportPage() {
  return (
    <main className="container mx-auto max-w-4xl p-4 sm:p-8 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Customer Support</h1>
        <p className="text-muted-foreground mt-2">We're here to help you on your journey.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Contact Us
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            For support, billing questions, or feedback, please email us at:
          </p>
          <a href="mailto:support@hungerfreeandhappy.app" className="text-primary font-semibold hover:underline">
            support@hungerfreeandhappy.app
          </a>
          <p className="text-sm text-muted-foreground mt-2">
            Our support team aims to respond to all inquiries within 48 hours.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>How do I reset my password?</AccordionTrigger>
              <AccordionContent>
                You can reset your password from the login page by clicking the "Forgot Password" link. If you are already logged in, you can change your password in the "My Account" section of the Settings dialog.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>How do I manage my subscription?</AccordionTrigger>
              <AccordionContent>
                You can manage your subscription, update your payment method, and view your invoice history by clicking "Manage Billing" in the "Subscription" section of the Settings dialog.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>What is your refund policy?</AccordionTrigger>
              <AccordionContent>
                As stated in our Terms of Service, all purchases and subscription fees are final and non-refundable. You can cancel your subscription at any time to prevent future charges.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </main>
  )
}
