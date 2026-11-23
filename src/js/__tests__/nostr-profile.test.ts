import { describe, it, expect } from "vitest";
import {
  changedFields,
  mergeProfile,
  parseProfileJson,
  profileToForm,
  validateProfileForm,
} from "src/js/nostr-profile";

describe("nostr profile editing", () => {
  it("parses only JSON objects", () => {
    expect(parseProfileJson('{"name":"a"}')).toEqual({ name: "a" });
    expect(parseProfileJson("[1]")).toEqual({});
    expect(parseProfileJson("nope")).toEqual({});
    expect(parseProfileJson(undefined)).toEqual({});
  });

  it("falls back to image for the picture field", () => {
    const form = profileToForm({ image: "https://x/y.png", name: 5 });
    expect(form.picture).toBe("https://x/y.png");
    expect(form.name).toBe("");
  });

  it("only reports fields that changed", () => {
    const before = profileToForm({ name: "alice", about: "hi" });
    const after = { ...before, about: "hello ", name: "alice " };
    expect(changedFields(before, after)).toEqual({ about: "hello" });
  });

  it("keeps unknown keys and fields edited elsewhere", () => {
    // Another client changed `about` and set a banner after the form opened.
    const latest = { name: "alice", about: "newer", banner: "https://b" };
    const merged = mergeProfile(latest, { name: "Alice" });
    expect(merged).toEqual({
      name: "Alice",
      about: "newer",
      banner: "https://b",
    });
  });

  it("removes cleared fields and keeps image in step", () => {
    const latest = { picture: "https://a", image: "https://a", lud16: "a@b.c" };
    expect(mergeProfile(latest, { picture: "https://n", lud16: "" })).toEqual({
      picture: "https://n",
      image: "https://n",
    });
  });

  it("validates urls and identifiers", () => {
    const ok = profileToForm({
      picture: "https://p.png",
      nip05: "example.com",
      lud16: "me@example.com",
    });
    expect(validateProfileForm(ok)).toEqual({});
    const bad = { ...ok, picture: "javascript:alert(1)", lud16: "nope" };
    expect(validateProfileForm(bad)).toEqual({
      picture: "url",
      lud16: "identifier",
    });
  });
});
