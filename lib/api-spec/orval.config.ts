import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          // Keep generated validators aligned with the shared Zod 4 runtime.
          version: 4,
          coerce: {
            // URL query and path parameters are already strings; coercing
            // them produces ZodCoercedString, which has no string formats.
            query: ['boolean', 'number'],
            param: ['boolean', 'number'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        operations: {
          // Orval's path validator collides with its generated query type when
          // an operation has both. This route validates the UUID in the server.
          getOwnContentAnalytics: { zod: { generate: { param: false } } },
          getProfileCommunityPosts: { zod: { generate: { param: false } } },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
