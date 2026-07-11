import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "ContextOptimizer",
  tagline: "AI Context Optimization Engine",
  favicon: "img/favicon.ico",
  url: "https://contextoptimizer.dev",
  baseUrl: "/",
  organizationName: "contextoptimizer",
  projectName: "contextoptimizer",
  onBrokenLinks: "throw",
  markdown: { mermaid: true },
  themes: ["@docusaurus/theme-mermaid"],
  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/contextoptimizer/contextoptimizer/tree/main/apps/docs/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    navbar: {
      title: "ContextOptimizer",
      items: [
        { type: "docSidebar", sidebarId: "docs", position: "left", label: "Docs" },
        { href: "https://github.com/contextoptimizer/contextoptimizer", label: "GitHub", position: "right" },
      ],
    },
    footer: {
      style: "dark",
      copyright: `Copyright © ${new Date().getFullYear()} ContextOptimizer Contributors`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
