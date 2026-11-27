// Routes of the Hashu Operator app (HASHU_APP=operator, issue #42).
const routes = [
  {
    path: "/",
    component: () => import("src/operator/OperatorLayout.vue"),
    children: [
      { path: "", component: () => import("src/operator/pages/HomePage.vue") },
      {
        path: "add",
        component: () => import("src/operator/pages/SignInPage.vue"),
      },
      {
        path: "mint/:id",
        component: () => import("src/operator/pages/MintPage.vue"),
      },
      {
        path: "settings",
        component: () => import("src/operator/pages/SettingsPage.vue"),
      },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export default routes;
