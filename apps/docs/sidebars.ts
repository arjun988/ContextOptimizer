import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docs: [
    "intro",
    {
      type: "category",
      label: "Architecture",
      items: ["architecture/overview", "architecture/sequence"],
    },
    {
      type: "category",
      label: "Guides",
      items: ["guides/developer", "guides/deployment", "guides/contributing"],
    },
    {
      type: "category",
      label: "SDKs",
      items: ["sdk/typescript", "sdk/python"],
    },
    {
      type: "category",
      label: "Plugins",
      items: ["plugins/embedder", "plugins/parser", "plugins/vector-store"],
    },
    "api/reference",
  ],
};

export default sidebars;
