<template>
  <div class="pool-setup-slide">
    <div class="content">
      <div class="header-icon">
        <div class="icon-circle">
          <PickaxeIcon :size="40" color="white" />
        </div>
      </div>

      <h1 class="title">{{ $t("WelcomePoolSetup.title") }}</h1>

      <p class="description">
        {{ $t("WelcomePoolSetup.text") }}
      </p>

      <div class="form" data-testid="onboarding-pool">
        <PoolSettingsForm />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { Pickaxe as PickaxeIcon } from "lucide-vue-next";
import PoolSettingsForm from "src/components/PoolSettingsForm.vue";

export default defineComponent({
  name: "WelcomePoolSetup",
  components: { PickaxeIcon, PoolSettingsForm },
});
</script>

<style scoped>
.pool-setup-slide {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--q-dark);
  color: white;
  padding: 40px 20px 20px 20px;
  box-sizing: border-box;
  overflow-y: auto;
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

.header-icon {
  margin-bottom: 20px;
}

.icon-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: center;
  align-items: center;
}

.title {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0 0 16px 0;
  color: white;
  line-height: 1.2;
  width: 100%;
}

.description {
  font-size: 0.95rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 24px 0;
  width: 100%;
}

.form {
  width: 100%;
}
</style>
