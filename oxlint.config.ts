import config from "@gameroman/config/oxlint/typeaware";

export default {
  ...config,
  rules: {
    ...config.rules,
    "typescript/no-misused-promises": [
      "error",
      { checksVoidReturn: { arguments: false } },
    ],
  },
};
