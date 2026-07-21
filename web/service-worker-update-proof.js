// Test-only update worker used by the WP13.7C browserproof. It is never cached by the app shell.
self.addEventListener("install", () => {});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "LUDYS_ACTIVATE_UPDATE") self.skipWaiting();
});
