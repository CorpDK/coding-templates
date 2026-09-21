import nextConfig from "@corpdk/eslint-config/next";
import storybook from "eslint-plugin-storybook";

export default [...nextConfig, ...storybook.configs["flat/recommended"]];
