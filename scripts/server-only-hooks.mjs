export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return {
      shortCircuit: true,
      url: new URL('./empty-server-only.js', import.meta.url).href,
      format: 'module',
    };
  }
  return nextResolve(specifier, context);
}
