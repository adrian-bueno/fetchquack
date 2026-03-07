// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: "https://adrian-bueno.github.io",
  base: "/fetchquack",
  integrations: [
    starlight({
      title: "fetchquack",
      description:
        "A lightweight, universal HTTP client for streaming, SSE, and progress tracking",
      favicon: "/favicon.png",
      logo: {
        dark: "./src/assets/fetchquack-logo-dark-theme.webp",
        light: "./src/assets/fetchquack-logo-light-theme.webp",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/adrian-bueno/fetchquack",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/adrian-bueno/fetchquack/edit/main/docs/",
      },
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", slug: "getting-started/introduction" },
            { label: "Installation", slug: "getting-started/installation" },
            { label: "Quick Start", slug: "getting-started/quick-start" },
          ],
        },
        {
          label: "Core Concepts",
          items: [
            { label: "HTTP Client", slug: "core/http-client" },
            { label: "Requests & Responses", slug: "core/requests-responses" },
            { label: "Interceptors", slug: "core/interceptors" },
          ],
        },
        {
          label: "Features",
          items: [
            { label: "Streaming", slug: "features/streaming" },
            { label: "Server-Sent Events", slug: "features/sse" },
            { label: "Progress Tracking", slug: "features/progress" },
            { label: "Retry Policies", slug: "features/retry" },
          ],
        },
        {
          label: "Integrations",
          items: [{ label: "Angular", slug: "integrations/angular" }],
        },
        {
          label: "API Reference",
          autogenerate: { directory: "api" },
        },
      ],
      customCss: ["./src/styles/custom.css"],
    }),
  ],
});
