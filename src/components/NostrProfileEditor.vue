<template>
  <!-- hashu.me: the wallet's own kind 0 Nostr profile, with an editor -->
  <q-item class="settings-control-item" data-testid="own-nostr-profile">
    <q-item-section>
      <div class="own-profile">
        <q-avatar size="56px" class="q-mr-md own-avatar">
          <img
            v-if="profile?.picture && !pictureFailed"
            :src="profile.picture"
            alt=""
            @error="pictureFailed = true"
          />
          <q-icon v-else name="person" size="32px" color="grey-6" />
        </q-avatar>
        <div class="own-names">
          <div class="own-name" data-testid="own-nostr-name">
            <template v-if="hasProfile">{{ displayName }}</template>
            <span v-else-if="!profileLoaded" class="text-grey-6">{{
              $t("Settings.nostr_profile.loading")
            }}</span>
            <span v-else class="text-grey-6">{{
              $t("Settings.nostr_profile.none")
            }}</span>
          </div>
          <div v-if="profile?.nip05" class="text-caption text-grey-6 ellipsis">
            {{ profile.nip05 }}
          </div>
          <div class="text-caption text-grey-6 ellipsis">{{ shortNpub }}</div>
        </div>
      </div>
      <div v-if="profile?.about" class="own-about q-mt-sm">
        {{ profile.about }}
      </div>
      <div class="q-mt-md">
        <q-btn
          rounded
          outline
          color="primary"
          size="sm"
          class="q-px-md"
          icon="edit"
          :label="
            hasProfile
              ? $t('Settings.nostr_profile.edit')
              : $t('Settings.nostr_profile.create')
          "
          :disable="!pubkey"
          data-testid="own-nostr-edit"
          @click="openEditor"
        />
      </div>
    </q-item-section>
  </q-item>

  <q-dialog v-model="editing" :persistent="profileSaving">
    <q-card class="q-pa-md profile-dialog" data-testid="own-nostr-dialog">
      <div class="text-h6 q-mb-sm">
        {{ $t("Settings.nostr_profile.edit") }}
      </div>
      <div
        v-if="signerLabel"
        class="text-caption text-grey-6 q-mb-md signer-note"
        data-testid="own-nostr-signer-note"
      >
        <q-icon name="info_outline" size="16px" class="q-mr-xs" />
        <span>
          {{
            $t("Settings.nostr_profile.signer_note", { signer: signerLabel })
          }}
          <template v-if="signerType === 'NIP07' || signerType === 'NIP46'">
            {{ $t("Settings.nostr_profile.signer_approve") }}
          </template>
        </span>
      </div>
      <q-form class="column q-gutter-sm" @submit.prevent="save">
        <q-input
          v-for="field in singleLineFields"
          :key="field"
          v-model="form[field]"
          outlined
          dense
          :label="$t(`Settings.nostr_profile.fields.${field}`)"
          :hint="hintFor(field)"
          :error="!!errors[field]"
          :error-message="errorFor(field)"
          :data-testid="`own-nostr-field-${field}`"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <q-input
          v-model="form.about"
          outlined
          dense
          autogrow
          type="textarea"
          :label="$t('Settings.nostr_profile.fields.about')"
          data-testid="own-nostr-field-about"
        />
        <div class="row justify-end q-gutter-sm q-mt-md">
          <q-btn
            flat
            rounded
            color="grey"
            :label="$t('Settings.nostr_profile.cancel')"
            :disable="profileSaving"
            v-close-popup
          />
          <q-btn
            rounded
            unelevated
            color="primary"
            type="submit"
            class="q-px-lg"
            :label="$t('Settings.nostr_profile.save')"
            :loading="profileSaving"
            data-testid="own-nostr-save"
          />
        </div>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapState } from "pinia";
import { nip19 } from "nostr-tools";
import { useNostrStore } from "src/stores/nostr";
import { useNostrUserStore } from "src/stores/nostrUser";
import { useWalletStore } from "src/stores/wallet";
import {
  changedFields,
  EditableProfileField,
  ProfileForm,
  profileToForm,
  validateProfileForm,
} from "src/js/nostr-profile";
import { notify, notifyError, notifySuccess } from "src/js/notify";

const KNOWN_ERRORS = [
  "relays_unreachable",
  "signer_mismatch",
  "publish_failed",
];

export default defineComponent({
  name: "NostrProfileEditor",
  setup() {
    // The wallet-seed signer reads the wallet store, whose state uses
    // useI18n(); create it here, inside setup, so signing later works even
    // when Settings is the first page opened.
    useWalletStore();
    return {};
  },
  data() {
    return {
      editing: false,
      pictureFailed: false,
      initial: profileToForm({}) as ProfileForm,
      form: profileToForm({}) as ProfileForm,
      errors: {} as Partial<Record<EditableProfileField, string>>,
      singleLineFields: [
        "display_name",
        "name",
        "picture",
        "nip05",
        "lud16",
      ] as EditableProfileField[],
    };
  },
  computed: {
    ...mapState(useNostrStore, ["pubkey", "signerType"]),
    ...mapState(useNostrUserStore, [
      "profile",
      "profileRaw",
      "profileLoaded",
      "profileSaving",
      "displayName",
    ]),
    hasProfile(): boolean {
      return Object.keys(this.profileRaw || {}).length > 0;
    },
    shortNpub(): string {
      if (!this.pubkey) return "";
      try {
        const npub = nip19.npubEncode(this.pubkey);
        return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
      } catch {
        return "";
      }
    },
    signerLabel(): string {
      const key = {
        NIP07: "signer_extension",
        PRIVATEKEY: "signer_nsec",
        NIP46: "signer_bunker",
      }[this.signerType as string];
      return key ? (this.$t(`Settings.nostr_profile.${key}`) as string) : "";
    },
  },
  watch: {
    "profile.picture"() {
      this.pictureFailed = false;
    },
  },
  async mounted() {
    // Fresh installs may not have set up a signer yet when Settings opens
    // first; do it here so there is an identity to show and edit.
    const nostr = useNostrStore();
    if (!nostr.pubkey) {
      try {
        await nostr.initSignerIfNotSet();
      } catch (e) {
        console.warn("[nostr-profile] signer init failed", e);
      }
    }
  },
  methods: {
    openEditor() {
      this.initial = profileToForm(this.profileRaw || {});
      this.form = { ...this.initial };
      this.errors = {};
      this.editing = true;
    },
    hintFor(field: EditableProfileField): string | undefined {
      const key = `Settings.nostr_profile.hints.${field}`;
      return this.$te(key) ? (this.$t(key) as string) : undefined;
    },
    errorFor(field: EditableProfileField): string | undefined {
      const code = this.errors[field];
      return code
        ? (this.$t(`Settings.nostr_profile.errors.${code}`) as string)
        : undefined;
    },
    async save() {
      this.errors = validateProfileForm(this.form);
      if (Object.keys(this.errors).length) return;
      const edits = changedFields(this.initial, this.form);
      if (!Object.keys(edits).length) {
        notify(this.$t("Settings.nostr_profile.unchanged") as string);
        this.editing = false;
        return;
      }
      try {
        const count = await useNostrUserStore().publishProfile(edits);
        notifySuccess(
          this.$t("Settings.nostr_profile.saved", { count }) as string
        );
        this.editing = false;
      } catch (e: any) {
        console.error("[nostr-profile] publish failed", e);
        const code = KNOWN_ERRORS.includes(e?.message) ? e.message : "generic";
        notifyError(this.$t(`Settings.nostr_profile.errors.${code}`) as string);
      }
    },
  },
});
</script>

<style scoped>
.own-profile {
  display: flex;
  align-items: center;
  min-width: 0;
}
.own-avatar {
  background: rgba(128, 128, 128, 0.15);
  flex-shrink: 0;
}
.own-names {
  min-width: 0;
}
.own-name {
  font-size: 17px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.own-about {
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-line;
  word-break: break-word;
  max-height: 8.4em;
  overflow-y: auto;
}
.profile-dialog {
  width: 100%;
  max-width: 440px;
}
.signer-note {
  display: flex;
  align-items: flex-start;
}
</style>
