import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { useWelcomeStore, WELCOME_SLIDES } from "src/stores/welcome";
import { useSettingsStore } from "src/stores/settings";
import { POOL_PRESETS } from "src/js/hashu-redeem";

describe("onboarding slides", () => {
  beforeEach(() => {
    useWelcomeStore().resetWelcome();
  });

  it("shows the pool step right after the intro, and it can be skipped", () => {
    const welcome = useWelcomeStore();
    welcome.goToNextSlide();
    expect(welcome.currentSlide).toBe(WELCOME_SLIDES.pool);
    expect(welcome.canProceed).toBe(true);
    welcome.goToNextSlide();
    expect(welcome.currentSlide).toBe(WELCOME_SLIDES.pwa);
  });

  it("ends the new path on mints and the recover path on restore", () => {
    const welcome = useWelcomeStore();
    welcome.setPath("new");
    welcome.setCurrentSlide(WELCOME_SLIDES.mints);
    expect(welcome.isLastSlide).toBe(true);
    welcome.setPath("recover");
    expect(welcome.isLastSlide).toBe(false);
    welcome.setCurrentSlide(WELCOME_SLIDES.restore);
    expect(welcome.isLastSlide).toBe(true);
  });

  it("needs a path on the choice slide and a checked seed after it", () => {
    const welcome = useWelcomeStore();
    welcome.setCurrentSlide(WELCOME_SLIDES.choice);
    expect(welcome.canProceed).toBe(false);
    welcome.setPath("new");
    expect(welcome.canProceed).toBe(true);
    welcome.setCurrentSlide(WELCOME_SLIDES.seed);
    expect(welcome.canProceed).toBe(false);
    welcome.validateSeedPhrase();
    expect(welcome.canProceed).toBe(true);
  });
});

describe("pool settings", () => {
  it("defaults to the first preset with no worker", () => {
    const settings = useSettingsStore();
    expect(settings.hashuPoolId).toBe(POOL_PRESETS[0].id);
    expect(settings.hashuWorkerName).toBe("");
  });

  it("saves the pool and worker to local storage", async () => {
    const settings = useSettingsStore();
    settings.hashuPoolId = "braiins";
    settings.hashuWorkerName = "alice.hashu";
    await nextTick();
    expect(localStorage.getItem("hashu.settings.poolId")).toBe("braiins");
    expect(localStorage.getItem("hashu.settings.workerName")).toBe(
      "alice.hashu"
    );
  });
});
