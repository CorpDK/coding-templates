import nextConfig from "@corpdk/eslint-config/next";
import storybook from "eslint-plugin-storybook";

const config = [...nextConfig, ...storybook.configs["flat/recommended"]];

export default config;
