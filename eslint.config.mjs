import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // 사용하지 않는 변수 관련 규칙 비활성화
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      // 사용하지 않는 매개변수도 허용
      "@typescript-eslint/no-unused-params": "off",
      // 변수 선언 후 사용하지 않는 경우도 허용
      "no-unused-expressions": "off",
    },
  },
];

export default eslintConfig;
