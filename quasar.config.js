/* eslint-env node */

/*
 * This file runs in a Node context (it's NOT transpiled by Babel), so use only
 * the ES6 features that are supported by your Node version. https://node.green/
 */

// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

const { configure } = require("quasar/wrappers");
const { execSync } = require("child_process");

function resolveGitCommit() {
  try {
    return execSync("git describe --always --dirty", {
      cwd: __dirname,
      stdio: "pipe",
    })
      .toString()
      .trim();
  } catch (err) {
    console.warn("Unable to resolve git commit via `git describe`");
    return "unknown";
  }
}

// HASHU_APP=operator builds Hashu Operator (issue #42) from this repo: its
// own routes, manifest and output folder (dist/operator), served on its own
// origin so its storage and sign-ins stay apart from the wallet's.
const HASHU_APP = process.env.HASHU_APP === "operator" ? "operator" : "wallet";
const OPERATOR = HASHU_APP === "operator";

// Hashu Operator has its own icons (dark badge, orange ring and cup; see
// scripts/render-operator-icons.mjs). The operator build serves public/ with
// public-operator/ laid over it, staged in node_modules/.cache.
function operatorPublicDir() {
  const fs = require("fs");
  const path = require("path");
  const dir = path.join(__dirname, "node_modules/.cache/hashu-operator-public");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(path.join(__dirname, "public"), dir, { recursive: true });
  fs.cpSync(path.join(__dirname, "public-operator"), dir, { recursive: true });
  return dir;
}

module.exports = configure(function (/* ctx */) {
  return {
    eslint: {
      // fix: true,
      // include: [],
      // exclude: [],
      // rawOptions: {},
      warnings: true,
      errors: true,
    },

    // https://v2.quasar.dev/quasar-cli/prefetch-feature
    // preFetch: true,

    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    // https://v2.quasar.dev/quasar-cli/boot-files
    boot: ["base", "global-components", "i18n"],

    // index.html: the installed app's name (Hashu or Hashu Operator).
    htmlVariables: OPERATOR
      ? { productName: "Hashu Operator", appName: "Hashu Operator" }
      : { appName: "Hashu" },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#css
    css: ["app.scss", "base.scss", "settings.scss"],

    // https://github.com/quasarframework/quasar/tree/dev/extras
    extras: [
      // 'ionicons-v4',
      // 'mdi-v5',
      // 'fontawesome-v6',
      // 'eva-icons',
      // 'themify',
      // 'line-awesome',
      // 'roboto-font-latin-ext', // this or either 'roboto-font', NEVER both!

      "roboto-font", // optional, you are not bound to it
      "material-icons", // optional, you are not bound to it
    ],

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#build
    build: {
      target: {
        browser: ["esnext"],
        node: "node16",
      },

      vueRouterMode: "history", // available values: 'hash', 'history'

      // Which app this build is (see HASHU_APP above).
      env: { HASHU_APP },
      ...(OPERATOR ? { distDir: "dist/operator" } : {}),
      // vueRouterBase,
      // vueDevtools,
      // vueOptionsAPI: false,

      // rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

      // publicPath: '/',
      // analyze: true,
      // env: {},
      // rawDefine: {}
      // ignorePublicFolder: true,
      // minify: false,
      // polyfillModulePreload: true,
      // distDir

      extendViteConf(viteConf) {
        viteConf.define = viteConf.define || {};
        viteConf.define.GIT_COMMIT = JSON.stringify(resolveGitCommit());
        if (OPERATOR) viteConf.publicDir = operatorPublicDir();
        // cashu-ts v4 ships ESM with BigInt — Vite's dep optimizer can mangle it
        viteConf.optimizeDeps = viteConf.optimizeDeps || {};
        viteConf.optimizeDeps.exclude = [
          ...(viteConf.optimizeDeps.exclude || []),
          "@agicash/qr-scanner",
          "@cashu/cashu-ts",
        ];
      },
      // viteVuePluginOptions: {},

      // vitePlugins: [
      //   [ 'package-name', { ..options.. } ]
      // ]
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#devServer
    devServer: {
      https: process.env.E2E !== "true",
      open: process.env.E2E !== "true", // keep automated runs headless
      port: OPERATOR ? 8081 : 8080,
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#framework
    framework: {
      config: {},

      iconSet: "material-icons", // Quasar icon set
      // lang: 'en-US', // Quasar language pack

      // For special cases outside of where the auto-import strategy can have an impact
      // (like functional components as one of the examples),
      // you can manually specify Quasar components/directives to be available everywhere:
      //
      // components: [],
      // directives: [],

      // Quasar plugins
      plugins: ["LocalStorage", "Notify", "Loading", "Dialog"],
    },

    animations: "all", // --- includes all animations
    // https://v2.quasar.dev/options/animations
    // animations: [],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#property-sourcefiles
    // sourceFiles: {
    //   rootComponent: 'src/App.vue',
    //   router: 'src/router/index',
    //   store: 'src/store/index',
    //   registerServiceWorker: 'src-pwa/register-service-worker',
    //   serviceWorker: 'src-pwa/custom-service-worker',
    //   pwaManifestFile: 'src-pwa/manifest.json',
    //   electronMain: 'src-electron/electron-main',
    //   electronPreload: 'src-electron/electron-preload'
    // },

    // https://v2.quasar.dev/quasar-cli/developing-ssr/configuring-ssr
    ssr: {
      // ssrPwaHtmlFilename: 'offline.html', // do NOT use index.html as name!
      // will mess up SSR

      // extendSSRWebserverConf (esbuildConf) {},
      // extendPackageJson (json) {},

      pwa: false,

      // manualStoreHydration: true,
      // manualPostHydrationTrigger: true,

      prodPort: 3000, // The default port that the production server should use
      // (gets superseded if process.env.PORT is specified at runtime)

      middlewares: [
        "render", // keep this as last one
      ],
    },

    // https://v2.quasar.dev/quasar-cli/developing-pwa/configuring-pwa
    pwa: {
      workboxMode: "generateSW", // or 'injectManifest'
      injectPwaMetaTags: true,
      swFilename: "sw.js",
      manifestFilename: "manifest.json",
      useCredentialsForManifestTag: false,
      workboxOptions: {
        skipWaiting: true,
        clientsClaim: true,
      },
      // useFilenameHashes: true,
      // extendGenerateSWOptions (cfg) {}
      // extendInjectManifestOptions (cfg) {},
      extendManifestJson(json) {
        if (!OPERATOR) return;
        json.name = "Hashu Operator";
        json.short_name = "Operator";
        json.description =
          "Run your Hashu mint: rigs, stock, redemptions, prices and messages.";
        json.id = "/";
        json.start_url = "/";
        delete json.protocol_handlers;
        delete json.screenshots;
        // The maskable icons are full-bleed squares; "any" gets the round badge.
        json.icons = json.icons.map((icon) =>
          icon.purpose === "any"
            ? { ...icon, src: "icons/icon-round-512x512.png" }
            : icon
        );
      },
      // extendPWACustomSWConf (esbuildConf) {}
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli/developing-cordova-apps/configuring-cordova
    cordova: {
      // noIosLegacyBuildFlag: true, // uncomment only if you know what you are doing
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli/developing-capacitor-apps/configuring-capacitor
    capacitor: {
      hideSplashscreen: false,
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli/developing-electron-apps/configuring-electron
    electron: {
      // extendElectronMainConf (esbuildConf)
      // extendElectronPreloadConf (esbuildConf)

      inspectPort: 5858,

      bundler: "packager", // 'packager' or 'builder'

      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options
        // OS X / Mac App Store
        // appBundleId: '',
        // appCategoryType: '',
        // osxSign: '',
        // protocol: 'myapp://path',
        // Windows only
        // win32metadata: { ... }
        asar: true,
        prune: true,
        ignore: [
          /(^|[\\/])node_modules([\\/]|$)/,
          /(^|[\\/])screenshots([\\/]|$)/,
          /(^|[\\/])package-lock\.json$/,
          /(^|[\\/])yarn\.lock$/,
          /(^|[\\/])pnpm-lock\.yaml$/,
          /(^|[\\/])vitest\.config\.js$/,
          /(^|[\\/])test([\\/]|$)/,
        ],
      },

      builder: {
        // https://www.electron.build/configuration/configuration

        appId: "me.cashu",
      },
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-browser-extensions/configuring-bex
    bex: {
      contentScripts: ["my-content-script"],

      // extendBexScriptsConf (esbuildConf) {}
      // extendBexManifestJson (json) {}
    },
  };
});
