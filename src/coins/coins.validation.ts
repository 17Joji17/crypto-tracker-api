export function validateSymbol(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const symbol = value.trim().toUpperCase();

  if (!/^[A-Z0-9]{2,20}$/.test(symbol)) {
    return null;
  }

  return symbol;
}