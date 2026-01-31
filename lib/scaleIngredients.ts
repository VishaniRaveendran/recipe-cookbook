/**
 * Multiply leading numbers/fractions in ingredient strings by a factor.
 * E.g. "2 cups flour" * 2 => "4 cups flour"; "1/2 tsp salt" * 2 => "1 tsp salt".
 * Leaves lines without a leading number unchanged (or appends " (Nx)" for clarity).
 */

function parseLeadingQuantity(text: string): { value: number; rest: string } | null {
  const trimmed = text.trim();
  // Match: optional "1 ", "1/2", "1 1/2", "2.5", "2"
  const fracMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)\s+(.+)$/);
  if (fracMatch) {
    const whole = parseInt(fracMatch[1], 10);
    const num = parseInt(fracMatch[2], 10);
    const den = parseInt(fracMatch[3], 10);
    const value = whole + num / den;
    return { value, rest: fracMatch[4].trim() };
  }
  const simpleFracMatch = trimmed.match(/^(\d+)\/(\d+)\s+(.+)$/);
  if (simpleFracMatch) {
    const num = parseInt(simpleFracMatch[1], 10);
    const den = parseInt(simpleFracMatch[2], 10);
    const value = num / den;
    return { value, rest: simpleFracMatch[3].trim() };
  }
  const numMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (numMatch) {
    const value = parseFloat(numMatch[1]);
    return { value, rest: numMatch[2].trim() };
  }
  return null;
}

function formatQuantity(value: number): string {
  if (value <= 0) return "";
  const intPart = Math.floor(value);
  const frac = value - intPart;
  if (frac < 0.01) return String(intPart);
  if (frac > 0.99) return String(intPart + 1);
  const tol = 0.001;
  if (Math.abs(frac - 0.25) < tol) return intPart ? `${intPart} 1/4` : "1/4";
  if (Math.abs(frac - 0.33) < tol || Math.abs(frac - 1 / 3) < tol)
    return intPart ? `${intPart} 1/3` : "1/3";
  if (Math.abs(frac - 0.5) < tol) return intPart ? `${intPart} 1/2` : "1/2";
  if (Math.abs(frac - 0.66) < tol || Math.abs(frac - 2 / 3) < tol)
    return intPart ? `${intPart} 2/3` : "2/3";
  if (Math.abs(frac - 0.75) < tol) return intPart ? `${intPart} 3/4` : "3/4";
  return value % 1 === 0 ? String(Math.round(value)) : value.toFixed(2);
}

export function scaleIngredientAmounts(
  ingredients: string[],
  factor: number
): string[] {
  if (factor === 1) return ingredients;
  return ingredients.map((line) => {
    const parsed = parseLeadingQuantity(line);
    if (!parsed) return line;
    const newValue = parsed.value * factor;
    const formatted = formatQuantity(newValue);
    if (!formatted) return line;
    return `${formatted} ${parsed.rest}`.trim();
  });
}
