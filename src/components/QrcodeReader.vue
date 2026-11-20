<script lang="ts">
import QrScanner, { type ScanResult } from "@agicash/qr-scanner";
import { URDecoder } from "@gandlaf21/bc-ur";
import zxingReaderWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import { useCameraStore } from "src/stores/camera";
import { mapActions, mapState } from "pinia";
import { useUiStore } from "src/stores/ui";
import { scanWordsImage } from "src/js/glossia";
import { notify, notifyError, notifyWarning } from "src/js/notify";

QrScanner.configureWasm({
  locateFile: () => zxingReaderWasmUrl,
});

export default {
  emits: ["decode"],
  data(): {
    qrScanner: QrScanner | null;
    urDecoder: URDecoder | null;
    urDecoderProgress: number;
    readingWords: boolean;
    wordsStatus: string;
    wordsProgress: number;
  } {
    return {
      qrScanner: null,
      urDecoder: null,
      urDecoderProgress: 0,
      readingWords: false,
      wordsStatus: "",
      wordsProgress: 0,
    };
  },
  mounted() {
    this.qrScanner = new QrScanner(
      this.$refs.cameraEl as HTMLVideoElement,
      (result: ScanResult) => {
        this.handleResult(result);
      },
      {
        calculateScanRegion: (video) => ({
          x: 0,
          y: 0,
          width: video.videoWidth,
          height: video.videoHeight,
        }),
        highlightCodeOutline: true,
        onDecodeError: () => {},
      }
    );
    this.qrScanner.start();
    this.urDecoder = new URDecoder();
  },
  computed: {
    ...mapState(useCameraStore, ["camera", "hasCamera"]),
    canPasteFromClipboard: function () {
      return (
        window.isSecureContext &&
        navigator.clipboard &&
        navigator.clipboard.readText
      );
    },
    wordsLabel: function (): string {
      // Tesseract reports "loading …"/"initializing …" while it starts and
      // "recognizing text" while it reads.
      if (!/^recogni/.test(this.wordsStatus)) {
        return this.$t("QrcodeReader.words.loading");
      }
      return this.$t("QrcodeReader.words.reading", {
        percentage: Math.round(this.wordsProgress * 100),
      });
    },
  },
  methods: {
    ...mapActions(useCameraStore, ["closeCamera", "showCamera"]),
    handleResult(result: ScanResult) {
      // if this is a multipart-qr code, do not yet emit
      if (result.data.toLowerCase().startsWith("ur:")) {
        this.urDecoder?.receivePart(result.data);
        this.urDecoderProgress =
          this.urDecoder?.estimatedPercentComplete() || 0;
        if (this.urDecoder?.isComplete() && this.urDecoder?.isSuccess()) {
          const ur = this.urDecoder?.resultUR();
          const decoded = ur.decodeCBOR();
          this.$emit("decode", decoded.toString());
          this.qrScanner?.stop();
          this.urDecoderProgress = 0;
        }
      } else {
        this.$emit("decode", result.data);
        this.qrScanner?.stop();
      }
    },
    // hashu.me: read a voucher written as Glossia words off the camera frame.
    readWords: async function () {
      if (this.readingWords) return;
      this.readingWords = true;
      this.wordsStatus = "";
      this.wordsProgress = 0;
      try {
        const r = await scanWordsImage(
          this.$refs.cameraEl as HTMLVideoElement,
          (status, fraction) => {
            this.wordsStatus = status;
            this.wordsProgress = fraction;
          }
        );
        if (r.token) {
          if (r.repaired > 0) {
            notify(
              this.$t("ReceiveTokenDialog.words.repaired", {
                count: r.repaired,
              })
            );
          }
          this.qrScanner?.stop();
          this.$emit("decode", r.token);
        } else {
          notifyWarning(
            this.$t("QrcodeReader.words.not_found", { count: r.words })
          );
        }
      } catch (e) {
        console.error(e);
        notifyError(
          this.$t("QrcodeReader.words.failed", {
            error: (e as Error)?.message || String(e),
          })
        );
      } finally {
        this.readingWords = false;
      }
    },
    pasteToParseDialog: async function () {
      const text = await useUiStore().pasteFromClipboard();
      if (text) {
        this.$emit("decode", text);
      }
    },
  },
  unmounted() {
    this.qrScanner?.destroy();
  },
};
</script>
<template>
  <q-card>
    <div class="text-center">
      <div>
        <video ref="cameraEl" style="width: 100%"></video>
      </div>
      <div>
        <div class="row q-justify-center">
          <q-linear-progress
            rounded
            size="30px"
            v-if="urDecoderProgress > 0"
            :value="urDecoderProgress"
            :indeterminate="urDecoderProgress === 0"
            class="q-mt-none"
            color="secondary"
          >
            <div class="absolute-full flex flex-center">
              <q-badge
                color="white"
                text-color="secondary"
                style="font-size: 1rem; padding: 5px"
                class="text-weight-bold"
                :label="
                  $t('QrcodeReader.progress.text', {
                    percentage: $t('QrcodeReader.progress.percentage', {
                      percentage: Math.round(urDecoderProgress * 100),
                    }),
                    addon:
                      urDecoderProgress > 0.9
                        ? $t('QrcodeReader.progress.keep_scanning_text')
                        : '',
                  })
                "
              />
            </div>
          </q-linear-progress>
          <q-linear-progress
            rounded
            size="30px"
            v-if="readingWords"
            :value="wordsProgress"
            :indeterminate="!/^recogni/.test(wordsStatus)"
            class="q-mt-none"
            color="secondary"
            data-testid="qr-read-words-progress"
          >
            <div class="absolute-full flex flex-center">
              <q-badge
                color="white"
                text-color="secondary"
                style="font-size: 1rem; padding: 5px"
                class="text-weight-bold"
                :label="wordsLabel"
              />
            </div>
          </q-linear-progress>
        </div>
      </div>
    </div>
    <div class="row q-my-sm">
      <q-btn
        unelevated
        v-if="canPasteFromClipboard"
        @click="pasteToParseDialog"
      >
        <q-icon name="content_paste" class="q-mr-sm" />
        {{ $t("QrcodeReader.actions.paste.label") }}</q-btn
      >
      <q-btn
        unelevated
        class="q-ml-sm"
        :loading="readingWords"
        data-testid="qr-read-words"
        @click="readWords"
      >
        <q-icon name="text_snippet" class="q-mr-sm" />
        {{ $t("QrcodeReader.actions.words.label") }}</q-btn
      >
      <q-btn @click="closeCamera" flat color="grey" class="q-ml-auto">{{
        $t("QrcodeReader.actions.close.label")
      }}</q-btn>
    </div>
  </q-card>
</template>
