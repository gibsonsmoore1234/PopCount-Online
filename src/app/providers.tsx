"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ApiClientError } from "@/lib/api/client";
import type { Me } from "@/types/api";
import { qk } from "@/hooks/api";

export function Providers({ children, me }: { children: ReactNode; me: Me | null }) {
  const [client] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: true,
          retry: (count, err) => !(err instanceof ApiClientError && err.status < 500) && count < 2,
        },
        mutations: { retry: false },
      },
    });
    // Seed the session from the server render so the header never flashes signed-out.
    qc.setQueryData(qk.me, me);
    return qc;
  });

  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      <Toaster
        position="bottom-center"
        offset={20}
        mobileOffset={{ bottom: 80 }}
        toastOptions={{
          classNames: {
            toast:
              "!rounded-xl !border-2 !border-ink !bg-ink !text-white !shadow-hard-sm !font-sans !font-extrabold !text-xs",
            description: "!text-white/70 !font-semibold",
            actionButton: "!bg-aura-high !text-ink !font-extrabold !rounded-lg",
          },
        }}
      />
    </QueryClientProvider>
  );
}
