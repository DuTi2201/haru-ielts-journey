import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { ApiError } from "@/lib/api/client";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // A 4xx answer is the server's final word (needs a purchase, not found, not signed in): asking
  // again three times only delays the page that explains it.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failures, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 3,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
