<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="operator-app op-add-worker" data-testid="add-worker-dialog">
      <q-card-section class="row items-center no-wrap q-pb-sm">
        <div class="text-h6 col">Add worker</div>
        <q-btn v-close-popup flat round dense icon="close" aria-label="Close" />
      </q-card-section>

      <q-card-section class="column q-gutter-y-md q-pt-none">
        <q-input
          v-model="rig"
          outlined
          dense
          autofocus
          label="Rig name"
          placeholder="bitaxe2"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          :maxlength="64"
          :hint="rigHint"
          data-testid="add-worker-rig"
        />
        <q-input
          v-if="!fixedPrefix"
          v-model="account"
          outlined
          dense
          label="Pool account (optional)"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          hint="Your account at the mint's default pool, if it needs one"
          data-testid="add-worker-account"
        />
        <q-input
          v-model="poolPassword"
          outlined
          dense
          label="Password (optional)"
          placeholder="x"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          hint="What the pool sees as the worker password. Empty means x."
          data-testid="add-worker-password"
        />
        <q-input
          v-if="needsSecret"
          v-model="secret"
          outlined
          dense
          type="password"
          :label="secretLabel"
          autocomplete="off"
          hint="Fills the password below. Not saved or sent anywhere."
          data-testid="add-worker-secret"
        />
      </q-card-section>

      <q-list class="op-card q-mx-md" dense separator>
        <q-item
          v-for="row in rows"
          :key="row.key"
          :clickable="!!row.copy"
          :data-testid="`worker-${row.key}`"
          @click="row.copy && copy(row.copy, row.label)"
        >
          <q-item-section class="op-muted col-auto q-pr-md">{{
            row.label
          }}</q-item-section>
          <q-item-section class="text-right items-end">
            <span
              class="op-mono op-fact-mono"
              :class="{ 'op-muted': row.placeholder }"
              >{{ row.value }}</span
            >
          </q-item-section>
          <q-item-section v-if="row.copy" side class="q-pl-sm">
            <q-icon
              name="content_copy"
              size="16px"
              :aria-label="`Copy ${row.label}`"
            />
          </q-item-section>
        </q-item>
      </q-list>

      <q-card-section class="text-caption op-muted">
        {{ note }}
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="content_copy"
          label="Copy all"
          :disable="!cleanRig"
          data-testid="add-worker-copy-all"
          @click="copy(allText, 'Worker settings')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import { copyToClipboard } from "quasar";
import { cleanRigName, poolPasswordFor, workerName } from "../format";

/**
 * How the mint tells this app a new rig should name itself: the operator
 * API's `proxy.workers`, or a supplier mint's own rule.
 */
export interface WorkerRules {
  /** Stratum URL rigs connect to. */
  stratum?: string;
  /** User prefix: the rig's user is `<prefix>.<rig>`. */
  prefix?: string | null;
  /** The password carries `pw=<secret>` (operator secret or supplier). */
  secret?: boolean;
  /** Label for the secret field. */
  secretLabel?: string;
  /** Who the rig mines for, for the note under the rows. */
  kind: "operator" | "supplier";
  /** Operator mint with no rig rule at all: every rig is borrowed. */
  open?: boolean;
}

export default defineComponent({
  name: "AddWorkerDialog",
  props: {
    modelValue: { type: Boolean, default: false },
    rules: { type: Object as PropType<WorkerRules>, required: true },
  },
  emits: ["update:modelValue"],
  data() {
    return { rig: "", account: "", secret: "", poolPassword: "" };
  },
  computed: {
    fixedPrefix(): string {
      return (this.rules.prefix || "").trim();
    },
    cleanRig(): string {
      return cleanRigName(this.rig);
    },
    rigHint(): string {
      if (this.rig && this.cleanRig !== this.rig.trim()) {
        return `Saved as ${this.cleanRig || "–"} (letters, digits, . _ - only)`;
      }
      return "Letters, digits, dot, dash and underscore";
    },
    /** Supplier rigs always prove their name with `pw=`; an operator rig
     * under the (deprecated) worker prefix is the operator's without it. */
    needsSecret(): boolean {
      if (!this.rules.secret) return false;
      return this.rules.kind === "supplier" || !this.fixedPrefix;
    },
    secretLabel(): string {
      return this.rules.secretLabel || "Rig secret";
    },
    worker(): string {
      const rig = this.cleanRig || "<rig>";
      return workerName(this.fixedPrefix || this.account, rig);
    },
    /** The rig's password: what the user typed (the pool's worker
     * password), plus `pw=<secret>` when the mint needs one. The mint takes
     * `pw=` out before the pool sees it. */
    password(): { value: string; placeholder: boolean } {
      return poolPasswordFor(
        this.poolPassword,
        this.needsSecret ? this.secret : null
      );
    },
    rows(): any[] {
      const ready = !!this.cleanRig;
      return [
        {
          key: "stratum",
          label: "Stratum",
          // Wrap after the scheme and before the port, not mid-word.
          value: (this.rules.stratum || "–")
            .replace("://", "://\u200b")
            .replace(/:(\d+)$/, "\u200b:$1"),
          copy: this.rules.stratum,
        },
        {
          key: "user",
          label: "Worker",
          value: this.worker,
          placeholder: !ready,
          copy: ready ? this.worker : undefined,
        },
        {
          key: "password",
          label: "Password",
          value: this.password.value,
          placeholder: this.password.placeholder,
          copy: this.password.placeholder ? undefined : this.password.value,
        },
      ];
    },
    allText(): string {
      return [
        `Stratum: ${this.rules.stratum || ""}`,
        `Worker: ${this.worker}`,
        `Password: ${this.password.value}`,
      ].join("\n");
    },
    note(): string {
      if (this.rules.kind === "supplier") {
        return "Use the rig secret you got at sign-up. Your rigs show up under Rigs once they send shares.";
      }
      if (this.fixedPrefix) {
        return `Workers named ${this.fixedPrefix}.<rig> mine for this mint. The rig shows up under Rigs once it sends shares.`;
      }
      if (this.needsSecret) {
        return "The pw= rig secret makes this one of the mint's own rigs. The rig shows up under Rigs once it sends shares.";
      }
      return "Any rig on this Stratum mines for the mint. It shows up under Rigs once it sends shares.";
    },
  },
  watch: {
    modelValue(open: boolean) {
      if (open) {
        this.rig = "";
        this.secret = "";
        this.poolPassword = "";
      }
    },
  },
  methods: {
    copy(text: string, label: string) {
      copyToClipboard(text)
        .then(() =>
          this.$q.notify({ message: `${label} copied`, timeout: 1500 })
        )
        .catch(() =>
          this.$q.notify({
            type: "negative",
            message: `Could not copy ${label}`,
          })
        );
    },
  },
});
</script>

<style lang="scss">
.op-add-worker {
  width: 440px;
  max-width: calc(100vw - 32px);
}
</style>
