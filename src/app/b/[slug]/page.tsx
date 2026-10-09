import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BubbleScreen } from "@/components/bubble/bubble-screen";
import { getBubbleBySlug } from "@/server/bubbles";
import { campusFeed } from "@/server/profiles";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const bubble = await getBubbleBySlug((await params).slug);
  if (!bubble) return { title: "Bubble not found" };
  return {
    title: `${bubble.name} — Campus Feed`,
    description: `${bubble.memberCount} members · ${bubble.profileCount} profiles · ${bubble.countyName} County, ${bubble.stateName}. ${bubble.description}`,
  };
}

export default async function BubblePage({ params }: Props) {
  const { slug } = await params;
  const bubble = await getBubbleBySlug(slug);
  if (!bubble) notFound();
  const feed = await campusFeed(bubble.id, { sort: "best", cursor: 0, limit: 24 });
  return (
    <Suspense>
      <BubbleScreen initialBubble={bubble} initialFeed={feed} />
    </Suspense>
  );
}
