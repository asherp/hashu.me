<template>
  <SettingsPageShell
    :title="$t('Settings.menu.pool.title')"
    :caption="$t('Settings.menu.pool.caption')"
  >
    <SettingsSection
      :title="$t('Settings.pool.title')"
      :caption="$t('Settings.pool.description')"
    >
      <div class="q-pa-md">
        <PoolSettingsForm :mint-url="activeMintUrl" />
      </div>
    </SettingsSection>
  </SettingsPageShell>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapState } from "pinia";
import { useMintsStore } from "src/stores/mints";
import PoolSettingsForm from "src/components/PoolSettingsForm.vue";
import SettingsPageShell from "./SettingsPageShell.vue";
import SettingsSection from "./SettingsSection.vue";

export default defineComponent({
  name: "PoolSettings",
  components: { PoolSettingsForm, SettingsPageShell, SettingsSection },
  computed: {
    ...mapState(useMintsStore, ["activeMintUrl"]),
  },
});
</script>
