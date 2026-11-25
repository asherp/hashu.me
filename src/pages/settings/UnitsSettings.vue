<template>
  <!-- hashu.me: units get their own page, next to Pool on the Settings menu -->
  <SettingsPageShell
    :title="$t('Settings.menu.units.title')"
    :caption="$t('Settings.menu.units.caption')"
  >
    <!-- hashu.me: display unit for TiH vouchers -->
    <SettingsSection
      :title="$t('Settings.appearance.hashu_unit.title')"
      :caption="$t('Settings.appearance.hashu_unit.description')"
    >
      <q-item tag="label">
        <q-item-section>
          <q-item-label>{{
            $t("Settings.appearance.hashu_unit.auto_scale.toggle")
          }}</q-item-label>
          <q-item-label caption>{{
            $t("Settings.appearance.hashu_unit.auto_scale.description")
          }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="hashuAutoScaleUnit"
            color="primary"
            data-testid="hashu-auto-scale"
          />
        </q-item-section>
      </q-item>
      <q-item
        v-for="unit in hashuDisplayUnits"
        :key="unit"
        clickable
        data-testid="hashu-display-unit"
        :data-unit="unit"
        @click="hashuDisplayUnit = unit"
        :active="hashuDisplayUnit === unit"
        active-class="text-weight-bold text-primary"
      >
        <q-item-section avatar>
          <q-icon
            :color="hashuDisplayUnit === unit ? 'primary' : 'grey'"
            :name="
              hashuDisplayUnit === unit
                ? 'check_circle'
                : 'radio_button_unchecked'
            "
          />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{
            $t(`Settings.appearance.hashu_unit.units.${unit}`)
          }}</q-item-label>
        </q-item-section>
      </q-item>
    </SettingsSection>

    <!-- hashu.me: monetary unit, replaces Cashu.me's ₿ symbol toggle -->
    <SettingsSection
      :title="$t('Settings.appearance.money_unit.title')"
      :caption="$t('Settings.appearance.money_unit.description')"
    >
      <q-item
        v-for="unit in moneyUnits"
        :key="unit"
        clickable
        data-testid="money-unit"
        :data-unit="unit"
        @click="moneyUnit = unit"
        :active="activeMoneyUnit === unit"
        active-class="text-weight-bold text-primary"
      >
        <q-item-section avatar>
          <q-icon
            :color="activeMoneyUnit === unit ? 'primary' : 'grey'"
            :name="
              activeMoneyUnit === unit
                ? 'check_circle'
                : 'radio_button_unchecked'
            "
          />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{
            $t(`Settings.appearance.money_unit.units.${unit}`)
          }}</q-item-label>
          <q-item-label caption>{{ moneyUnitExample(unit) }}</q-item-label>
          <q-item-label caption v-if="unit === 'usd'">{{
            $t("Settings.appearance.money_unit.usd_source")
          }}</q-item-label>
        </q-item-section>
      </q-item>
    </SettingsSection>
  </SettingsPageShell>
</template>

<script lang="ts">
import {
  DEFAULT_DISPLAY_UNIT,
  DISPLAY_UNITS,
  formatHashprice,
  isDisplayUnit,
} from "src/js/hashu";
import { MONEY_UNITS, formatSats, toMoneyUnit } from "src/js/money";
import { defineComponent } from "vue";
import { mapState, mapWritableState } from "pinia";
import { useSettingsStore } from "src/stores/settings";
import { useMintsStore } from "src/stores/mints";
import { usePriceStore } from "src/stores/price";
import SettingsPageShell from "./SettingsPageShell.vue";
import SettingsSection from "./SettingsSection.vue";

export default defineComponent({
  name: "UnitsSettings",
  components: {
    SettingsPageShell,
    SettingsSection,
  },
  computed: {
    ...mapWritableState(useSettingsStore, [
      "moneyUnit",
      "hashuDisplayUnit",
      "hashuAutoScaleUnit",
    ]),
    ...mapState(useMintsStore, ["activeMintUrl"]),
    ...mapState(usePriceStore, ["hashuPrices"]),
    moneyUnits() {
      return MONEY_UNITS;
    },
    activeMoneyUnit() {
      return toMoneyUnit(this.moneyUnit);
    },
    hashuDisplayUnits() {
      return Object.keys(DISPLAY_UNITS);
    },
  },
  methods: {
    /** "1,234 sat · 46 sats/THd": an amount, and the active mint's price if known. */
    moneyUnitExample(unit) {
      const money = {
        ...usePriceStore().money(this.activeMintUrl),
        unit,
      };
      const amount = formatSats(1234, money, navigator.language);
      const msat = this.hashuPrices[this.activeMintUrl]?.msatPerPih;
      if (!msat) return amount;
      const hashUnit = isDisplayUnit(this.hashuDisplayUnit)
        ? this.hashuDisplayUnit
        : DEFAULT_DISPLAY_UNIT;
      return `${amount} · ${formatHashprice(
        msat,
        hashUnit,
        navigator.language,
        money
      )}`;
    },
  },
});
</script>
