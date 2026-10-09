import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Privacy Notice" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Notice" updated="October 9, 2026">
      <h2>What we store</h2>
      <ul>
        <li>Account: email, handle, a salted scrypt hash of your password, role and boost-credit balance.</li>
        <li>Profile (only if you create one): display name, gender tag, affiliation, bio and photo.</li>
        <li>Activity: ratings, boosts, comments, group messages and reports you make.</li>
        <li>Session cookie (httpOnly) and a cookie recording that you accepted the terms.</li>
      </ul>
      <h2>What is public</h2>
      <p>
        Your profile, aggregate scores, comments and group messages (with your handle) are public. Individual ratings
        are never shown to anyone.
      </p>
      <h2>Photos</h2>
      <p>
        Uploaded photos are cropped and re-encoded in your browser before upload, which strips embedded metadata such as
        GPS location.
      </p>
      <h2>Deletion</h2>
      <p>Deleting your profile permanently removes it along with its ratings and comments.</p>
    </LegalPage>
  );
}
