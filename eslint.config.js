import { solvro } from "@solvro/config/eslint";

export default solvro(
  {
    rules: {
      "import/no-default-export": "off",
    },
  },
  {
    ignores: ["app/admin/components/*.tsx"],
  },
);
