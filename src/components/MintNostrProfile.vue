<template>
  <!-- hashu.me: the mint's kind 0 Nostr profile, shown when its Nostr
       contact row is expanded on the mint details page -->
  <div class="mint-nostr-profile" data-testid="mint-nostr-profile">
    <div v-if="loading" class="row items-center q-py-sm text-grey-6">
      <q-spinner size="18px" class="q-mr-sm" />
      {{ $t("MintDetailsDialog.contact.nostr.loading") }}
    </div>
    <template v-else>
      <div v-if="profile" class="profile-head">
        <q-avatar size="48px" class="q-mr-md profile-avatar">
          <img
            v-if="profile.picture && !pictureFailed"
            :src="profile.picture"
            alt=""
            @error="pictureFailed = true"
          />
          <q-icon v-else name="person" size="28px" color="grey-6" />
        </q-avatar>
        <div class="profile-names">
          <div class="profile-name" data-testid="mint-nostr-name">
            {{ profile.display_name || profile.name || shortNpub }}
          </div>
          <div
            v-if="profile.display_name && profile.name"
            class="text-caption text-grey-6"
          >
            {{ profile.name }}
          </div>
          <div
            v-if="profile.nip05"
            class="text-caption nip05"
            data-testid="mint-nostr-nip05"
          >
            <q-icon
              v-if="nip05Verified === true"
              name="verified"
              color="primary"
              size="14px"
              class="q-mr-xs"
            >
              <q-tooltip>{{
                $t("MintDetailsDialog.contact.nostr.nip05_verified")
              }}</q-tooltip>
            </q-icon>
            <q-icon
              v-else-if="nip05Verified === false"
              name="error_outline"
              color="warning"
              size="14px"
              class="q-mr-xs"
            >
              <q-tooltip>{{
                $t("MintDetailsDialog.contact.nostr.nip05_unverified")
              }}</q-tooltip>
            </q-icon>
            <span :class="nip05Verified === false ? 'text-grey-6' : ''">{{
              nip05Display
            }}</span>
          </div>
        </div>
      </div>
      <div
        v-if="profile?.about"
        class="profile-about q-mt-sm"
        data-testid="mint-nostr-about"
      >
        {{ profile.about }}
      </div>
      <div
        v-if="!profile"
        class="text-caption text-grey-6 q-py-xs"
        data-testid="mint-nostr-none"
      >
        {{ $t("MintDetailsDialog.contact.nostr.none") }}
      </div>

      <div class="profile-links q-mt-sm">
        <a
          v-if="profile?.website"
          :href="profile.website"
          target="_blank"
          rel="noopener noreferrer"
          class="profile-link"
          data-testid="mint-nostr-website"
        >
          <q-icon name="language" size="16px" class="q-mr-xs" />
          {{ websiteLabel }}
        </a>
        <a
          v-if="canMessage"
          href="#"
          class="profile-link"
          data-testid="mint-nostr-message"
          @click.prevent="$emit('message')"
        >
          <q-icon name="chat_bubble_outline" size="16px" class="q-mr-xs" />
          {{ $t("MintDetailsDialog.contact.nostr.message") }}
        </a>
        <a
          :href="njump"
          target="_blank"
          rel="noopener noreferrer"
          class="profile-link"
          data-testid="mint-nostr-open"
        >
          <q-icon name="open_in_new" size="16px" class="q-mr-xs" />
          {{ $t("MintDetailsDialog.contact.nostr.open") }}
        </a>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import NDK, { NDKFilter, NDKKind, NDKRelaySet } from "@nostr-dev-kit/ndk";
import { useNostrStore } from "src/stores/nostr";
import {
  MintNostrProfile,
  displayNip05,
  njumpUrl,
  parseProfileContent,
  verifyNip05,
} from "src/js/mint-nostr";

// Profiles fetched this session, by pubkey (null = none found).
const cache = new Map<string, MintNostrProfile | null>();

const FETCH_TIMEOUT_MS = 8000;

export default defineComponent({
  name: "MintNostrProfile",
  emits: ["message"],
  props: {
    pubkey: { type: String, required: true },
    npub: { type: String, required: true },
    // Extra relays to ask: nprofile hints and the mint's announced relays.
    relays: { type: Array as PropType<string[]>, default: () => [] },
    // hashu.me: show "Message" (the mint takes NIP-17 messages)
    canMessage: { type: Boolean, default: false },
  },
  data() {
    return {
      loading: true,
      profile: null as MintNostrProfile | null,
      nip05Verified: null as boolean | null,
      pictureFailed: false,
    };
  },
  computed: {
    njump(): string {
      return njumpUrl(this.npub);
    },
    shortNpub(): string {
      return `${this.npub.slice(0, 12)}…${this.npub.slice(-6)}`;
    },
    nip05Display(): string {
      return this.profile?.nip05 ? displayNip05(this.profile.nip05) : "";
    },
    websiteLabel(): string {
      const w = this.profile?.website || "";
      return w.replace(/^https?:\/\//, "").replace(/\/$/, "");
    },
  },
  watch: {
    pubkey() {
      this.load();
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    async load() {
      const pk = this.pubkey;
      this.pictureFailed = false;
      this.nip05Verified = null;
      if (cache.has(pk)) {
        this.profile = cache.get(pk) || null;
        this.loading = false;
      } else {
        this.loading = true;
        const profile = await this.fetchProfile(pk);
        if (pk !== this.pubkey) return;
        cache.set(pk, profile);
        this.profile = profile;
        this.loading = false;
      }
      if (this.profile?.nip05) {
        const ok = await verifyNip05(this.profile.nip05, pk);
        if (pk === this.pubkey) this.nip05Verified = ok;
      }
    },
    async fetchProfile(pk: string): Promise<MintNostrProfile | null> {
      try {
        const nostr = useNostrStore();
        if (!nostr.connected || !nostr.ndk) nostr.initNdkReadOnly();
        const ndk = nostr.ndk as unknown as NDK;
        const filter: NDKFilter = {
          kinds: [NDKKind.Metadata],
          authors: [pk],
          limit: 1,
        };
        const urls = Array.from(
          new Set([...(nostr.relays || []), ...this.relays])
        ).filter((u) => /^wss?:\/\//.test(u));
        const relaySet = urls.length
          ? NDKRelaySet.fromRelayUrls(urls, ndk)
          : undefined;
        const events = await Promise.race([
          ndk.fetchEvents(filter, { closeOnEose: true }, relaySet),
          new Promise<null>((r) => setTimeout(() => r(null), FETCH_TIMEOUT_MS)),
        ]);
        if (!events) return null;
        let latest: { created_at?: number; content: string } | undefined;
        events.forEach((e) => {
          if (!latest || (e.created_at || 0) > (latest.created_at || 0))
            latest = e;
        });
        return parseProfileContent(latest?.content);
      } catch (e) {
        console.warn("[mint-nostr] profile fetch failed", e);
        return null;
      }
    },
  },
});
</script>

<style scoped>
.mint-nostr-profile {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(128, 128, 128, 0.08);
}
.profile-head {
  display: flex;
  align-items: center;
}
.profile-avatar {
  background: rgba(128, 128, 128, 0.15);
  flex-shrink: 0;
}
.profile-names {
  min-width: 0;
}
.profile-name {
  font-size: 16px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nip05 {
  display: flex;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-about {
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-line;
  word-break: break-word;
  max-height: 8.4em;
  overflow-y: auto;
}
.profile-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.profile-link {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  color: var(--q-primary);
  text-decoration: none;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
