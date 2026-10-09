import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutSuccess } from "@/components/credits/checkout-success";

export const metadata: Metadata = { title: "Purchase complete" };

export default function CreditsSuccessPage() {
  return (
    <Suspense>
      <CheckoutSuccess />
    </Suspense>
  );
}
