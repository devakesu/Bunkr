import { ApiReference } from "@scalar/nextjs-api-reference";

export const GET = ApiReference({
  spec: {
    url: "/api-docs/openapi.yaml",
  },
  theme: "purple",
  layout: "modern",
  darkMode: true,
  showSidebar: true,
  defaultOpenAllTags: true,
  authentication: {
    preferredSecurityScheme: "SupabaseAuth",
  },
});
