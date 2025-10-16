
export default function TosPage() {
  return (
    <main className="container mx-auto max-w-4xl p-4 sm:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="space-y-4">
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">1. Introduction</h2>
          <p className="text-muted-foreground">
            Welcome to Hunger Free and Happy ("App," "we," "us," or "our"). These Terms of Service ("Terms") govern your use of our application and services. By accessing or using our App, you agree to be bound by these Terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">2. Medical Disclaimer</h2>
          <p className="text-muted-foreground">
            The App is intended as a tool to help you track your habits and choices based on the principles of the "Hunger Free and Happy" book. It is not a medical device, nor does it provide medical advice. Always consult with a qualified healthcare professional before making any decisions about your health. Your use of this App is solely at your own risk.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">3. Subscriptions and Payment</h2>
          <p className="text-muted-foreground">
            Certain features of the App are available through paid subscriptions. By purchasing a subscription, you agree to pay the fees specified. <strong>All purchases and subscription fees are final and non-refundable.</strong> We reserve the right to change our subscription plans or adjust pricing in the future.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">4. User Conduct</h2>
          <p className="text-muted-foreground">
            You agree not to use the App for any unlawful purpose or to engage in any activity that could harm the App or its users. You are responsible for maintaining the confidentiality of your account and password.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">5. Limitation of Liability</h2>
          <p className="text-muted-foreground">
            To the fullest extent permitted by law, in no event will we be liable for any indirect, incidental, special, consequential or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the App.
          </p>
        </section>

         <section className="space-y-2">
          <h2 className="text-2xl font-semibold">6. Changes to Terms</h2>
          <p className="text-muted-foreground">
            We reserve the right to modify these terms at any time. We will provide notice of material changes by updating the "Last updated" date at the top of these Terms. Your continued use of the App after any such changes constitutes your acceptance of the new Terms.
          </p>
        </section>
      </div>
    </main>
  );
}
