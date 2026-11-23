// hashu.me: helpers for editing the wallet's own kind 0 Nostr profile.
//
// A kind 0 event replaces the whole profile, so publishing only the fields
// the wallet knows about would wipe anything another client set (banner,
// website, bot flags, ...). Saving therefore re-reads the latest profile
// from the relays, applies only the fields the user actually changed, and
// keeps every other key as it was.

export const EDITABLE_PROFILE_FIELDS = [
  "name",
  "display_name",
  "picture",
  "about",
  "nip05",
  "lud16",
] as const;

export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];
export type ProfileForm = Record<EditableProfileField, string>;

export function parseProfileJson(content?: string): Record<string, unknown> {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Form values for the editable fields; `image` stands in for `picture`. */
export function profileToForm(raw: Record<string, unknown>): ProfileForm {
  const form = {} as ProfileForm;
  for (const key of EDITABLE_PROFILE_FIELDS) {
    const v = raw[key] ?? (key === "picture" ? raw.image : undefined);
    form[key] = typeof v === "string" ? v : "";
  }
  return form;
}

/** Fields whose trimmed value differs between the two forms. */
export function changedFields(
  before: ProfileForm,
  after: ProfileForm
): Partial<ProfileForm> {
  const out: Partial<ProfileForm> = {};
  for (const key of EDITABLE_PROFILE_FIELDS) {
    const a = (after[key] || "").trim();
    if ((before[key] || "").trim() !== a) out[key] = a;
  }
  return out;
}

/**
 * Apply edits onto the latest profile. An empty value removes the key.
 * Unknown keys are kept untouched.
 */
export function mergeProfile(
  latest: Record<string, unknown>,
  edits: Partial<ProfileForm>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...latest };
  for (const [key, value] of Object.entries(edits)) {
    const v = (value ?? "").trim();
    if (v) merged[key] = v;
    else delete merged[key];
    // Older clients write `image`; keep it in step so they show the change.
    if (key === "picture" && "image" in latest) {
      if (v) merged.image = v;
      else delete merged.image;
    }
  }
  return merged;
}

/** Light checks so a typo doesn't get published. Returns i18n-free codes. */
export function validateProfileForm(
  form: ProfileForm
): Partial<Record<EditableProfileField, "url" | "identifier">> {
  const errors: Partial<Record<EditableProfileField, "url" | "identifier">> =
    {};
  const pic = form.picture.trim();
  if (pic && !/^https:\/\/\S+$/i.test(pic)) errors.picture = "url";
  const ident = /^[a-z0-9._+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
  const nip05 = form.nip05.trim();
  if (nip05 && !ident.test(nip05) && !ident.test(`_@${nip05}`))
    errors.nip05 = "identifier";
  const lud16 = form.lud16.trim();
  if (lud16 && !ident.test(lud16)) errors.lud16 = "identifier";
  return errors;
}
