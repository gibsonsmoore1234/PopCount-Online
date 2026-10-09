import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Privacy Notice" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Notice" updated="October 9, 2026">
      <h2>What we store</h2>
      <ul>
        <li>
          Anonymous visitors: a random handle (e.g. anon_3fa9c1), a click balance, and an httpOnly session cookie.
        </li>
        <li>Accounts (only needed to create your own profile): email, handle and a salted scrypt password hash.</li>
        <li>Profiles: display name, gender tag, affiliation, bio and photo.</li>
        <li>Activity: ratings, comments, reports, bubbles you create and ads you watch.</li>
        <li>A cookie recording that you accepted the terms.</li>
      </ul>
      <h2>What is public</h2>
      <p>
        Profiles, aggregate scores and comments (with the commenter&apos;s handle) are public. Individual ratings are
        never shown to anyone.
      </p>
      <h2>Photos</h2>
      <p>Uploaded photos are cropped and re-encoded in your browser before upload, which strips location metadata.</p>
      <h2>Advertising</h2>
      <p>We do not sell your data to advertisers.</p>
      <h2>Deletion</h2>
      <p>Deleting your profile permanently removes it along with its ratings and comments.</p>
    </LegalPage>
  );
}
