import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 9, 2026">
      <p>
        These terms govern your use of Pop Count (popcount.online). They are a starting template — have them reviewed by
        a lawyer before launching publicly.
      </p>
      <h2>1. Eligibility</h2>
      <p>You must be at least 18 years old to use Pop Count.</p>
      <h2>2. Anonymous use</h2>
      <p>
        You can browse, rate, comment and report without signing up. Your device is given an anonymous handle so we can
        keep your clicks and stop abuse. Creating a profile requires a free account, and you may only create a profile
        of yourself.
      </p>
      <h2>3. Your content &amp; responsibility</h2>
      <p>
        You are solely and legally responsible for the photos, text, comments and ratings you submit. You may only post
        content that you own or have permission to use. You grant us a non-exclusive licence to host and display it for
        operating the service.
      </p>
      <h2>4. Ratings are opinions</h2>
      <p>Popularity scores are aggregated opinions of users, not statements of fact by Pop Count.</p>
      <h2>5. Clicks &amp; ads</h2>
      <p>
        Pop Count is free. Rating, commenting, creating a profile or a bubble each use one click. You start with 100
        clicks and can earn more by watching short ads. Clicks have no cash value and cannot be bought, sold or
        transferred.
      </p>
      <h2>6. Moderation</h2>
      <p>We may remove content or suspend accounts and devices that violate the Community Guidelines or these terms.</p>
      <h2>7. Disclaimers</h2>
      <p>The service is provided “as is” without warranties of any kind, to the extent permitted by law.</p>
      <h2>8. Changes</h2>
      <p>We may update these terms; material changes will require you to accept them again before continuing.</p>
    </LegalPage>
  );
}
