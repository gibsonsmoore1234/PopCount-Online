import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Community Guidelines" };

export default function GuidelinesPage() {
  return (
    <LegalPage title="Community Guidelines" updated="October 9, 2026">
      <p>
        Popularity Contest is a game people choose to play. These rules keep it fun for everyone in it. Breaking them
        gets content removed and accounts suspended.
      </p>
      <h2>Opt-in only</h2>
      <ul>
        <li>You can only create a profile of yourself, with photos of yourself that you own.</li>
        <li>Never post, describe or rate someone who hasn&apos;t opted in — including in comments and group chats.</li>
        <li>You can edit or permanently delete your profile at any time.</li>
      </ul>
      <h2>Be decent</h2>
      <ul>
        <li>No bullying, harassment, threats or coordinated pile-ons.</li>
        <li>
          No hate speech or attacks based on race, ethnicity, religion, gender, sexual orientation, disability or
          national origin.
        </li>
        <li>No body shaming — comments about bodies, weight or appearance-based insults are removed.</li>
        <li>
          No doxxing: don&apos;t share anyone&apos;s private information (addresses, schedules, phone numbers, private
          accounts).
        </li>
        <li>No nudity or sexual content, and nothing involving anyone under 18.</li>
      </ul>
      <h2>Aura advice</h2>
      <p>
        The advice thread is for constructive, kind suggestions — vibe, bio, photo quality, getting involved. Not for
        criticism of how someone looks.
      </p>
      <h2>Reporting</h2>
      <p>
        Use the flag on any profile, comment, message or bubble. Comments and messages that several people report are
        hidden automatically until a moderator reviews them.
      </p>
      <p>
        See also the{" "}
        <Link href="/terms" className="font-bold underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-bold underline">
          Privacy Notice
        </Link>
        .
      </p>
    </LegalPage>
  );
}
