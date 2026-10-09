import { describe, expect, it } from "vitest";
import { createProfileSchema, imageUrlSchema, signupSchema } from "@/lib/validation";

describe("image URLs", () => {
  it.each([
    ["https://images.example.com/me.jpg", true],
    ["/api/images/3f1c2a4e-1b2c-4d3e-8f9a-0b1c2d3e4f5a", true],
    ["/api/avatar/caroline_v", true],
    ["http://insecure.example.com/a.jpg", false],
    ["javascript:alert(1)", false],
    ["data:image/png;base64,AAAA", false],
    ["https://user:pass@example.com/a.jpg", false],
    ["/api/images/../../etc/passwd", false],
  ])("%s → %s", (url, ok) => {
    expect(imageUrlSchema.safeParse(url).success).toBe(ok);
  });
});

describe("profiles are opt-in", () => {
  const base = {
    bubbleId: "3f1c2a4e-1b2c-4d3e-8f9a-0b1c2d3e4f5a",
    displayName: "Caroline Vance",
    gender: "FEMALE",
    bio: "",
    photoUrl: "https://example.com/me.jpg",
  };
  it("requires the self-consent attestation", () => {
    expect(createProfileSchema.safeParse(base).success).toBe(false);
    expect(createProfileSchema.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(createProfileSchema.safeParse({ ...base, consent: true }).success).toBe(true);
  });
});

describe("signup", () => {
  const base = { email: "A@B.edu", handle: "good_handle", password: "longenough" };
  it("requires 18+ and terms", () => {
    expect(signupSchema.safeParse(base).success).toBe(false);
    const ok = signupSchema.safeParse({ ...base, ageConfirmed: true, termsAccepted: true });
    expect(ok.success).toBe(true);
    expect(ok.data?.email).toBe("a@b.edu");
  });
  it("rejects bad handles and short passwords", () => {
    expect(
      signupSchema.safeParse({ ...base, handle: "no spaces", ageConfirmed: true, termsAccepted: true }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ ...base, password: "short", ageConfirmed: true, termsAccepted: true }).success,
    ).toBe(false);
  });
});
