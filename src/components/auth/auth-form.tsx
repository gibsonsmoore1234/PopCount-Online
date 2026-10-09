"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useLogin, useSignup } from "@/hooks/api";
import { useTerms } from "@/stores/terms-store";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api/client";
import { loginSchema, signupSchema } from "@/lib/validation";

function safeNext(next: string | null) {
  // Only same-site relative paths — never redirect off-site.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const login = useLogin();
  const signup = useSignup();
  const acceptTerms = useTerms((s) => s.accept);
  const uid = useId();
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = login.isPending || signup.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "login") {
      const parsed = loginSchema.safeParse({ identifier, password });
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form.");
      login.mutate(parsed.data, {
        onSuccess: () => {
          toast.success("Welcome back!");
          router.push(next);
          router.refresh();
        },
        onError: (err) => setError(errorMessage(err)),
      });
    } else {
      const parsed = signupSchema.safeParse({ email, handle, password, ageConfirmed: adult, termsAccepted: terms });
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form.");
      signup.mutate(parsed.data, {
        onSuccess: () => {
          acceptTerms();
          toast.success("Account created!", {
            description: "Next: create your profile to join the rankings.",
            action: { label: "Create profile", onClick: () => router.push("/?create=1") },
          });
          router.push(next === "/" ? "/?create=1" : next);
          router.refresh();
        },
        onError: (err) => setError(errorMessage(err)),
      });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {mode === "login" ? (
        <Field label="Email or handle" htmlFor={`${uid}-id`}>
          <Input
            id={`${uid}-id`}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            placeholder="you@school.edu or @handle"
            autoFocus
          />
        </Field>
      ) : (
        <>
          <Field label="Email" htmlFor={`${uid}-email`}>
            <Input
              id={`${uid}-email`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@school.edu"
              autoFocus
            />
          </Field>
          <Field
            label="Handle"
            htmlFor={`${uid}-handle`}
            hint="3–20 letters, numbers or underscores. Shown on your comments."
          >
            <div className="border-ink focus-within:shadow-hard-sm flex h-10 items-center rounded-xl border-2 bg-white pl-3">
              <span className="text-muted text-sm font-black">@</span>
              <input
                id={`${uid}-handle`}
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))}
                autoComplete="nickname"
                maxLength={20}
                placeholder="yourhandle"
                className="h-full min-w-0 flex-1 bg-transparent px-1 text-sm font-semibold focus:outline-none"
              />
            </div>
          </Field>
        </>
      )}
      <Field label="Password" htmlFor={`${uid}-pw`} hint={mode === "signup" ? "At least 8 characters." : undefined}>
        <div className="relative">
          <Input
            id={`${uid}-pw`}
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="hover:bg-surface-2 absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      {mode === "signup" && (
        <div className="space-y-2">
          <Checkbox id={`${uid}-adult`} checked={adult} onChange={setAdult}>
            I&apos;m <b>18 or older</b>.
          </Checkbox>
          <Checkbox id={`${uid}-terms`} checked={terms} onChange={setTerms}>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="underline underline-offset-2">
              Terms
            </Link>{" "}
            &{" "}
            <Link href="/guidelines" target="_blank" className="underline underline-offset-2">
              Community Guidelines
            </Link>
            .
          </Checkbox>
        </div>
      )}

      {error && (
        <p role="alert" className="border-ink bg-aura-low/25 rounded-xl border-2 px-3 py-2 text-xs font-bold">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Spinner />} {mode === "login" ? "Log in" : "Create account"}
      </Button>
    </form>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pc-dotgrid bg-surface grid min-h-[calc(100dvh-4rem)] place-items-center px-3 py-10">
      <div className="border-ink shadow-hard-lg w-full max-w-md rounded-2xl border-[3px] bg-white">
        <div className="border-ink border-b-2 px-6 py-5">
          <h1 className="text-2xl font-black tracking-tight uppercase">{title}</h1>
          <p className="text-muted mt-0.5 text-xs font-semibold">{subtitle}</p>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
