import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 9, 2026">
      <p>
        These terms govern your use of Pop Count (popcount.ai). They are a starting template — have them reviewed by a
        lawyer before launching publicly.
      </p>
      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years old. By creating an account you confirm that you are, and that you are a member of
        the community you join.
      </p>
      <h2>2. Your content & responsibility</h2>
      <p>
        You are solely and legally responsible for the photos, text, comments and ratings you submit. You may only post
        content of yourself that you own or have permission to use. You grant us a worldwide, non-exclusive licence to
        host and display it for operating the service.
      </p>
      <h2>3. Ratings are opinions</h2>
      <p>Aura scores are aggregated opinions of users, not statements of fact by Pop Count.</p>
      <h2>4. Boost credits</h2>
      <p>
        Boost credits are a limited, revocable licence to use a paid feature. They have no cash value, are
        non-transferable and are non-refundable except where required by law. Boosts are capped per profile per day.
      </p>
      <h2>5. Moderation</h2>
      <p>
        We may remove content or suspend accounts that violate the Community Guidelines or these terms, at our
        discretion.
      </p>
      <h2>6. Disclaimers</h2>
      <p>
        The service is provided “as is” without warranties of any kind. To the extent permitted by law, our liability is
        limited to the amount you paid us in the past 12 months.
      </p>
      <h2>7. Changes</h2>
      <p>
        We may update these terms; material changes will require you to accept them again before continuing to use the
        service.
      </p>
    </LegalPage>
  );
}
