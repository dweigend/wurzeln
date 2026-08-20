/**
 * Shared DOM validation and number formatting for the concrete demo UIs.
 * Element selection and event semantics remain local to each demo adapter.
 */

const integerFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

export function getRequiredElement<ElementType extends Element>(
  id: string,
  elementType: { new (): ElementType },
): ElementType {
  const element = document.getElementById(id);
  if (!(element instanceof elementType)) throw new Error(`Missing UI element: #${id}.`);
  return element;
}

export function formatInteger(value: number): string {
  return integerFormat.format(value);
}

export function formatDecimal(value: number): string {
  return decimalFormat.format(value);
}
