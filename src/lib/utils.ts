import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function genderLabel(g: "MALE" | "FEMALE" | "NON_BINARY", short = false) {
  if (short) return { MALE: "M", FEMALE: "F", NON_BINARY: "NB" }[g];
  return { MALE: "Male", FEMALE: "Female", NON_BINARY: "Non-binary" }[g];
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** Logo monogram: "Ole Miss" → OM, "UCLA" → UCLA, "Duke" → DU. */
export function monogram(name: string) {
  const words = name.split(/[\s-]+/).filter((w) => /[a-z0-9]/i.test(w));
  if (words.length > 1)
    return words
      .slice(0, 3)
      .map((w) => w[0]!.toUpperCase())
      .join("");
  const w = words[0] ?? "?";
  if (w === w.toUpperCase() && w.length <= 4) return w;
  return w.slice(0, 2).toUpperCase();
}
