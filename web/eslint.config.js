import nextConfig from "eslint-config-next/core-web-vitals";

export default [
  ...nextConfig,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off"
    }
  }
];
