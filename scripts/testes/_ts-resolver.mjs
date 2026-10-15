// Hook do Node: resolve import relativo sem extensao ("./types") para o .ts
// correspondente, como o Next/TypeScript fazem. Usado pelos testes puros:
//   npm test   (node --import ./scripts/testes/_registrar.mjs --test scripts/testes/*.test.mjs)
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (erro) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw erro;
  }
}
