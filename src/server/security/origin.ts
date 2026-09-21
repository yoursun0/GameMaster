import 'server-only';

export function originAllowed(
  originHeader: string | null,
  appOrigin: string,
): boolean {
  return originHeader === appOrigin;
}
