
export default function PrivacyPage() {
  return (
    <main className="container mx-auto max-w-4xl p-4 sm:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="space-y-4">
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">1. Introduction</h2>
          <p className="text-muted-foreground">
            Your privacy is important to us. This Privacy Policy explains how Hunger Free and Happy ("we," "us," or "our") collects, uses, and discloses information about you when you use our application.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">2. Information We Collect</h2>
          <p className="text-muted-foreground">
            We collect information you provide directly to us, such as when you create an account, log your activities, and communicate with us. This includes:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li><strong>Account Information:</strong> Your name, email address, and password.</li>
            <li><strong>Health and Activity Data:</strong> Your logged meals, activities, sleep patterns, measurements, and other related data you choose to provide.</li>
            <li><strong>Payment Information:</strong> We use a third-party payment processor (Stripe) to handle payments. We do not store your full credit card information.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">3. How We Use Your Information</h2>
          <p className="text-muted-foreground">
            We use the information we collect to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Provide, maintain, and improve our services.</li>
            <li>Personalize your experience and provide insights.</li>
            <li>Process transactions and send you related information.</li>
            <li>Communicate with you about products, services, offers, and events.</li>
            <li>Monitor and analyze trends, usage, and activities in connection with our services.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">4. How We Share Your Information</h2>
          <p className="text-muted-foreground">
            We do not share your personal information with third parties except as described in this Privacy Policy. We may share information with vendors, consultants, and other service providers who need access to such information to carry out work on our behalf (e.g., payment processing).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">5. Data Security</h2>
          <p className="text-muted-foreground">
            We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">6. Your Choices</h2>
          <p className="text-muted-foreground">
            You may update, correct, or delete information about you at any time by logging into your online account or emailing us. Please note that we may retain certain information as required by law or for legitimate business purposes.
          </p>
        </section>
      </div>
    </main>
  );
}
