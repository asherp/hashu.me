<template>
  <q-page class="op-page" style="max-width: 520px">
    <q-tabs
      v-model="kind"
      dense
      no-caps
      align="justify"
      class="q-mb-md"
      active-color="primary"
      indicator-color="primary"
    >
      <q-tab name="operator" label="Operator mint" />
      <q-tab name="supplier" label="Supplier mint" />
    </q-tabs>

    <q-form @submit.prevent="submit" class="column q-gutter-y-md">
      <div class="op-muted text-body2">
        <template v-if="kind === 'operator'">
          The mint you run, with the operator user and password from its
          <span class="op-mono">.env</span> (the same login as its
          <span class="op-mono">/operator/</span> dashboard).
        </template>
        <template v-else>
          A hosted supplier mint (<span class="op-mono">name.hashu.io</span>),
          with the dashboard key you got at sign-up.
        </template>
      </div>
      <q-input
        v-model="url"
        outlined
        label="Mint address"
        placeholder="https://mint.example.com"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        inputmode="url"
        data-testid="signin-url"
        :rules="[(v) => !!v.trim() || 'Enter the mint address']"
        lazy-rules
      />
      <template v-if="kind === 'operator'">
        <q-input
          v-model="user"
          outlined
          label="User"
          autocapitalize="off"
          autocomplete="username"
          data-testid="signin-user"
        />
        <q-input
          v-model="password"
          outlined
          label="Password"
          :type="show ? 'text' : 'password'"
          autocomplete="current-password"
          data-testid="signin-password"
        >
          <template #append>
            <q-icon
              :name="show ? 'visibility_off' : 'visibility'"
              class="cursor-pointer"
              @click="show = !show"
            />
          </template>
        </q-input>
      </template>
      <q-input
        v-else
        v-model="key"
        outlined
        label="Dashboard key"
        :type="show ? 'text' : 'password'"
        autocomplete="off"
        data-testid="signin-key"
      >
        <template #append>
          <q-icon
            :name="show ? 'visibility_off' : 'visibility'"
            class="cursor-pointer"
            @click="show = !show"
          />
        </template>
      </q-input>
      <q-banner v-if="error" dense rounded class="op-alert op-alert-error">
        {{ error }}
      </q-banner>
      <q-btn
        type="submit"
        unelevated
        rounded
        no-caps
        color="primary"
        size="lg"
        :loading="busy"
        label="Sign in"
        data-testid="signin-submit"
      />
      <div class="text-caption op-muted">
        The sign-in lasts up to 7 days, and ends when the mint restarts. Nothing
        here can spend vouchers: those stay in your wallet.
      </div>
    </q-form>
  </q-page>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useOperatorStore } from "../store";

export default defineComponent({
  name: "OperatorSignInPage",
  data() {
    const q = this.$route.query;
    return {
      kind: (q.kind === "supplier" ? "supplier" : "operator") as
        | "operator"
        | "supplier",
      url: (q.url as string) || "",
      user: (q.user as string) || "operator",
      password: "",
      key: "",
      show: false,
      busy: false,
      error: "",
    };
  },
  methods: {
    async submit() {
      this.error = "";
      if (!this.url.trim()) return;
      this.busy = true;
      const store = useOperatorStore();
      try {
        const m =
          this.kind === "operator"
            ? await store.addOperatorMint(this.url, this.user, this.password)
            : await store.addSupplierMint(this.url, this.key);
        this.password = "";
        this.key = "";
        this.$router.replace(`/mint/${m.id}`);
      } catch (e: any) {
        this.error = e?.message || String(e);
      } finally {
        this.busy = false;
      }
    },
  },
});
</script>
