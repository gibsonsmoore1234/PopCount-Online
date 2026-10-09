import { describe, expect, it } from "vitest";
import { lookupCounty } from "@/lib/geo/county";
import { censorText, containsBlockedLanguage } from "@/lib/moderation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { sniffImageType } from "@/server/images";

describe("county lookup (bubble placement + 100-per-county cap)", () => {
  it("resolves campuses to their counties", () => {
    expect(lookupCounty(36.0014, -78.9382)).toMatchObject({ fips: "37063", county: "Durham", state: "North Carolina" });
    expect(lookupCounty(34.3647, -89.5384)).toMatchObject({ county: "Lafayette", state: "Mississippi" });
    expect(lookupCounty(34.0689, -118.4452)).toMatchObject({ county: "Los Angeles", state: "California" });
  });
  it("rejects points outside the U.S.", () => {
    expect(lookupCounty(30, -60)).toBeNull(); // Atlantic
    expect(lookupCounty(51.5, -0.12)).toBeNull(); // London
  });
});

describe("moderation", () => {
  it("masks profanity including leetspeak, leaves clean text alone", () => {
    expect(censorText("Grove Saturdays are the best")).toBe("Grove Saturdays are the best");
    expect(censorText("no sh1t")).not.toContain("sh1t");
    expect(containsBlockedLanguage("fuuuuck")).toBe(true);
    expect(containsBlockedLanguage("Scunthorpe United")).toBe(false); // no false positive on substrings
  });
});

describe("passwords", () => {
  it("hashes with scrypt and verifies", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("upload sniffing", () => {
  it("trusts magic bytes, not names", () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(Buffer.from("89504e470d0a1a0a0000", "hex"))).toBe("image/png");
    expect(sniffImageType(Buffer.from("RIFF0000WEBPVP8 ", "ascii"))).toBe("image/webp");
    expect(sniffImageType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });
});
