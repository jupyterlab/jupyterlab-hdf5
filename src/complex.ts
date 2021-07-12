export type Complex = [number, number];

type ComplexArrayOrVal = ComplexArrayOrVal[] | Complex;
type StringArrayOrVal = StringArrayOrVal[] | string;

export function convertValuesToString(c: ComplexArrayOrVal): StringArrayOrVal {
  if (isComplexValue(c)) {
    return `${c[0]}${c[1] >= 0 ? '+' : ''}${c[1]}i`;
  }

  return c.map(inner => convertValuesToString(inner));
}

export function isComplexDtype(dtype: string): boolean {
  return dtype.includes('c');
}

export function isComplexArray(
  data: (number | Complex)[][],
  dtype: string
): data is Complex[][] {
  return isComplexDtype(dtype);
}

function isComplexValue(c: ComplexArrayOrVal): c is Complex {
  return typeof c[0] === 'number';
}
