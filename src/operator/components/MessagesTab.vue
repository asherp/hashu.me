<template>
  <div>
    <div v-if="!inbox" class="op-card q-pa-md op-muted">
      Messages aren't available on this mint.
    </div>
    <template v-else>
      <div v-if="!inbox.on" class="op-card q-pa-md op-muted q-mb-md">
        Direct messages are off: set HASHU_NOSTR_RELAYS on the mint so people
        can message it at its npub.
      </div>
      <div class="text-caption op-muted q-mb-sm ellipsis">
        Messages to <span class="op-mono">{{ inbox.npub }}</span>
      </div>

      <q-list v-if="!peer" class="op-card" separator>
        <q-item v-if="!conversations.length" class="op-muted"
          >No messages yet.</q-item
        >
        <q-item
          v-for="c in conversations"
          :key="c.peer"
          clickable
          data-testid="conversation"
          @click="openPeer(c.peer)"
        >
          <q-item-section>
            <q-item-label class="op-mono ellipsis">{{
              short(c.npub)
            }}</q-item-label>
            <q-item-label caption class="ellipsis">{{
              preview(lastOf(c))
            }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-item-label caption>{{ fmtAgo(c.last_at * 1000) }}</q-item-label>
            <q-badge
              v-if="c.unread"
              rounded
              color="orange-8"
              :label="c.unread"
            />
          </q-item-section>
        </q-item>
      </q-list>

      <div v-else class="op-card q-pa-md">
        <div class="row items-center q-mb-sm">
          <q-btn
            flat
            dense
            round
            icon="arrow_back"
            aria-label="All messages"
            @click="peer = ''"
          />
          <div class="col op-mono ellipsis q-ml-sm">{{ current?.npub }}</div>
        </div>
        <div class="column q-gutter-y-sm op-thread">
          <div
            v-for="msg in current?.messages || []"
            :key="msg.id"
            class="op-bubble"
            :class="msg.outgoing ? 'op-bubble-out' : 'op-bubble-in'"
          >
            <div
              v-if="hashesOf(msg.text)"
              class="row items-center no-wrap q-gutter-x-xs"
            >
              <HashuLogoIcon :size="16" />
              <span class="text-weight-medium">Hashes</span>
              <span class="op-muted">{{ hashesOf(msg.text) }}</span>
            </div>
            <div v-else style="white-space: pre-wrap">{{ msg.text }}</div>
            <div class="text-caption op-muted q-mt-xs">
              {{ fmtTime(msg.created_at * 1000) }}
            </div>
          </div>
        </div>
        <div class="row q-gutter-sm items-end q-mt-md no-wrap">
          <q-input
            v-model="text"
            class="col"
            outlined
            dense
            autogrow
            placeholder="Reply"
            data-testid="reply-input"
            @keydown.enter.exact.prevent="reply"
          />
          <q-btn
            unelevated
            round
            color="primary"
            icon="send"
            aria-label="Send"
            :disable="!text.trim()"
            :loading="busy === 'reply'"
            @click="reply"
          />
        </div>
        <div class="row q-mt-sm">
          <q-btn flat no-caps dense @click="hashesOpen = true">
            <HashuLogoIcon :size="16" class="q-mr-xs" /> Send hashes
          </q-btn>
        </div>
      </div>
    </template>

    <q-dialog v-model="hashesOpen">
      <q-card style="min-width: 300px; max-width: 420px">
        <q-card-section class="text-h6 row items-center q-gutter-x-sm">
          <HashuLogoIcon :size="22" /><span>Send hashes</span>
        </q-card-section>
        <q-card-section class="column q-gutter-y-md q-pt-none">
          <div class="text-body2 op-muted">
            The mint issues new hashes and sends them in a direct message. They
            count as owed, like any sale.
          </div>
          <q-input
            v-model.number="amount"
            outlined
            dense
            type="number"
            min="1"
            step="1"
            label="Amount (TiH)"
            :hint="amount ? fmtHashes(amount) : ''"
          />
          <q-input v-model="note" outlined dense label="Note (optional)" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Send"
            :disable="!(amount > 0)"
            :loading="busy === 'hashes'"
            @click="sendHashes"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import HashuLogoIcon from "components/icons/HashuLogoIcon.vue";
import { call, type OperatorMint } from "../api";
import type { MintSnapshot } from "../store";
import { fmtAgo, fmtHashes, fmtTime } from "../format";

export default defineComponent({
  name: "MessagesTab",
  components: { HashuLogoIcon },
  props: {
    mint: { type: Object as PropType<OperatorMint>, required: true },
    snap: { type: Object as PropType<MintSnapshot>, required: true },
  },
  emits: ["changed"],
  data() {
    return {
      peer: "",
      text: "",
      busy: "",
      hashesOpen: false,
      amount: 1024 as number | null,
      note: "",
    };
  },
  computed: {
    inbox(): any {
      return this.snap.inbox;
    },
    conversations(): any[] {
      return [...(this.inbox?.conversations || [])].sort(
        (a, b) => b.last_at - a.last_at
      );
    },
    current(): any {
      return this.conversations.find((c) => c.peer === this.peer);
    },
  },
  methods: {
    fmtAgo,
    fmtHashes,
    fmtTime,
    short(npub: string) {
      return npub && npub.length > 24
        ? `${npub.slice(0, 14)}…${npub.slice(-8)}`
        : npub;
    },
    lastOf(c: any) {
      return c.messages?.[c.messages.length - 1];
    },
    preview(m: any) {
      if (!m) return "";
      const h = this.hashesOf(m.text);
      return (m.outgoing ? "You: " : "") + (h ? `Hashes ${h}` : m.text);
    },
    /** A NUT-18 payment payload (hashes sent over DM): its amount. */
    hashesOf(text: string): string | null {
      if (!text || text[0] !== "{") return null;
      try {
        const v = JSON.parse(text);
        if (!Array.isArray(v.proofs)) return null;
        const tih = v.proofs.reduce(
          (a: number, p: any) => a + (Number(p.amount) || 0),
          0
        );
        return `${fmtHashes(tih)}${v.memo ? ` · ${v.memo}` : ""}`;
      } catch {
        return null;
      }
    },
    async openPeer(peer: string) {
      this.peer = peer;
      const c = this.current;
      if (c?.unread) {
        await call(this.mint, "/api/inbox/read", { body: { peer } }).catch(
          () => {}
        );
        this.$emit("changed");
      }
    },
    async reply() {
      const text = this.text.trim();
      if (!text) return;
      this.busy = "reply";
      try {
        await call(this.mint, "/api/inbox/reply", {
          body: { peer: this.peer, text },
        });
        this.text = "";
        this.$emit("changed");
      } catch (e: any) {
        this.$q.notify({
          type: "negative",
          message: e?.message || String(e),
          position: "top",
        });
      } finally {
        this.busy = "";
      }
    },
    async sendHashes() {
      this.busy = "hashes";
      try {
        await call(this.mint, "/api/inbox/send-hashes", {
          body: {
            peer: this.peer,
            amount_tih: Math.round(Number(this.amount)),
            note: this.note.trim(),
          },
        });
        this.hashesOpen = false;
        this.note = "";
        this.$q.notify({ message: "Hashes sent", position: "top" });
        this.$emit("changed");
      } catch (e: any) {
        this.$q.notify({
          type: "negative",
          message: e?.message || String(e),
          position: "top",
          timeout: 0,
          actions: [{ icon: "close", color: "white" }],
        });
      } finally {
        this.busy = "";
      }
    },
  },
});
</script>

<style lang="scss">
.op-thread {
  max-height: 55vh;
  overflow-y: auto;
}
.op-bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(128, 128, 128, 0.12);
}
.op-bubble-out {
  align-self: flex-end;
  background: rgba(128, 128, 128, 0.25);
}
.op-bubble-in {
  align-self: flex-start;
}
</style>
