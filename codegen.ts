import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "./src/schemas/*.ts",
  generates: {
    "./src/types.ts": {
      plugins: ["typescript", "typescript-resolvers"],
      config: {
        contextType: "./context.js#MyContext",
        enumsAsTypes: true,
        scalars: {
          URL: "string",
        }
      },
    },
  },
};

export default config;
