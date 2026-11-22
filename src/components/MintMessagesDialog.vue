<template>
  <!-- hashu.me: private messages (NIP-17) with a mint, opened from the
       Nostr contact on the mint details page -->
  <q-dialog
    :model-value="modelValue"
    position="bottom"
    :maximized="$q.screen.lt.sm"
    transition-show="slide-up"
    transition-hide="slide-down"
    @update:model-value="$emit('update:modelValue', $event)"
    @show="onShow"
    @hide="onHide"
  >
    <q-card
      class="drawer-card text-white full-width-card messages-card column no-wrap"
      data-testid="mint-messages"
    >
      <q-card-section class="row items-center no-wrap q-pb-sm">
        <q-btn flat round dense v-close-popup class="q-ml-sm" color="primary">
          <XIcon />
        </q-btn>
        <div class="col text-center ellipsis q-px-sm">
          <div class="text-h6 ellipsis">
            {{ title || $t("MintDetailsDialog.contact.messages.title") }}
          </div>
          <div class="text-caption text-grey-6 ellipsis">{{ shortNpub }}</div>
        </div>
        <div style="width: 40px" class="row justify-center">
          <q-spinner v-if="syncing" size="18px" color="grey-6" />
        </div>
      </q-card-section>

      <div
        ref="scroller"
        class="col bubbles q-px-md"
        data-testid="mint-messages-list"
      >
        <div
          v-if="!messages.length"
          class="text-grey-6 text-center q-pa-lg empty"
          data-testid="mint-messages-empty"
        >
          {{ $t("MintDetailsDialog.contact.messages.empty") }}
        </div>
        <div
          v-for="m in messages"
          :key="m.id"
          class="bubble"
          :class="{ out: m.outgoing }"
          :data-testid="m.outgoing ? 'mint-message-out' : 'mint-message-in'"
        >
          <div class="bubble-text">{{ m.text }}</div>
          <div class="bubble-time">{{ when(m.created_at) }}</div>
        </div>
      </div>

      <q-card-section class="q-pt-sm composer">
        <div class="text-caption text-grey-6 q-mb-xs">
          {{ $t("MintDetailsDialog.contact.messages.who") }}
        </div>
        <div class="row items-end no-wrap q-gutter-x-sm">
          <q-input
            v-model="draft"
            class="col"
            outlined
            dense
            rounded
            autogrow
            :maxlength="maxText"
            :placeholder="$t('MintDetailsDialog.contact.messages.placeholder')"
            data-testid="mint-message-input"
            @keydown.enter.exact.prevent="send"
          />
          <q-btn
            round
            unelevated
            color="primary"
            text-color="black"
            icon="send"
            :loading="sending"
            :disable="!draft.trim()"
            data-testid="mint-message-send"
            @click="send"
          >
            <q-tooltip>{{
              $t("MintDetailsDialog.contact.messages.send")
            }}</q-tooltip>
          </q-btn>
        </div>
        <div v-if="error" class="text-negative text-caption q-mt-xs">
          {{ error }}
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { X as XIcon } from "lucide-vue-next";
import { useMintMessagesStore, MAX_TEXT } from "src/stores/mintMessages";
import { useWalletStore } from "src/stores/wallet";

const SYNC_EVERY_MS = 15000;

export default defineComponent({
  name: "MintMessagesDialog",
  components: { XIcon },
  props: {
    modelValue: { type: Boolean, default: false },
    pubkey: { type: String, required: true },
    npub: { type: String, required: true },
    relays: { type: Array as PropType<string[]>, default: () => [] },
    mintUrl: { type: String, default: "" },
    title: { type: String, default: "" },
  },
  emits: ["update:modelValue"],
  setup() {
    // The wallet store reads i18n when it is created, which only works
    // inside setup: make sure it exists before messages need the seed
    // (the details page can be opened directly).
    useWalletStore();
    return {};
  },
  data() {
    return {
      draft: "",
      sending: false,
      error: "",
      timer: 0 as ReturnType<typeof setInterval> | 0,
      maxText: MAX_TEXT,
    };
  },
  computed: {
    store() {
      return useMintMessagesStore();
    },
    messages() {
      return this.store.conversations[this.pubkey]?.messages || [];
    },
    syncing(): boolean {
      return this.store.syncing;
    },
    shortNpub(): string {
      return `${this.npub.slice(0, 12)}…${this.npub.slice(-6)}`;
    },
  },
  watch: {
    "messages.length"() {
      this.store.markRead(this.pubkey);
      this.$nextTick(this.scrollToEnd);
    },
  },
  beforeUnmount() {
    this.onHide();
  },
  methods: {
    onShow() {
      this.store.open(this.pubkey, this.relays, this.mintUrl, this.title);
      this.store.markRead(this.pubkey);
      this.$nextTick(this.scrollToEnd);
      this.store.sync(this.pubkey);
      clearInterval(this.timer as any);
      this.timer = setInterval(
        () => this.store.sync(this.pubkey),
        SYNC_EVERY_MS
      );
    },
    onHide() {
      clearInterval(this.timer as any);
      this.timer = 0;
      this.store.markRead(this.pubkey);
    },
    scrollToEnd() {
      const el = this.$refs.scroller as HTMLElement | undefined;
      if (el) el.scrollTop = el.scrollHeight;
    },
    when(s: number): string {
      return new Date(s * 1000).toLocaleString(this.$i18n.locale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    async send() {
      const text = this.draft.trim();
      if (!text || this.sending) return;
      this.sending = true;
      this.error = "";
      try {
        this.store.open(this.pubkey, this.relays, this.mintUrl, this.title);
        await this.store.send(this.pubkey, text);
        this.draft = "";
      } catch (e: any) {
        console.warn("[mint-messages] send failed", e);
        this.error = this.$t("MintDetailsDialog.contact.messages.failed", {
          error: e?.message || String(e),
        }) as string;
      } finally {
        this.sending = false;
      }
    },
  },
});
</script>

<style scoped>
.messages-card {
  min-height: 70vh;
  max-height: 90vh;
}
.bubbles {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  padding-bottom: 8px;
  min-height: 0;
}
.empty {
  margin: auto 0;
  line-height: 1.45;
}
.bubble {
  max-width: 82%;
  align-self: flex-start;
  padding: 8px 12px;
  border-radius: 16px 16px 16px 4px;
  background: rgba(128, 128, 128, 0.18);
}
.bubble.out {
  align-self: flex-end;
  border-radius: 16px 16px 4px 16px;
  background: var(--q-primary);
  color: #111;
}
.bubble-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 15px;
  line-height: 1.4;
}
.bubble-time {
  font-size: 11px;
  opacity: 0.65;
  margin-top: 2px;
  text-align: right;
}
</style>
