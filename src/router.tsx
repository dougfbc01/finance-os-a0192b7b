import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// After a new publish, an open tab may request page files that no longer exist.
// Reload once to pick up the current version instead of showing a blank screen.
if (typeof window !== "undefined") {
  const key = "chunk-reload-at";
  const recover = () => {
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  };
  window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); recover(); });
  window.addEventListener("unhandledrejection", (e) => {
    if (/Failed to fetch dynamically imported module|Importing a module script failed/.test(String(e.reason?.message ?? e.reason))) recover();
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
