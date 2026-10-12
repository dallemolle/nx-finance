import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Desestruturar pra descartar campos (`const { a, ...rest } = obj`) é o
      // jeito de omitir propriedades; `a` não conta como variável sem uso.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
      // Avisa que o React Compiler pularia componentes que usam `watch()` do
      // react-hook-form. O compilador não está ligado (next.config), então não
      // há efeito. Se ligar, religar a regra e trocar `watch()` por `useWatch()`.
      "react-hooks/incompatible-library": "off",
    },
  },
];

export default eslintConfig;
