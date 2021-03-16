export type Complex = [number, number];

export function convertToStr(c: Complex): string {
  return `${c[0]}${c[1] >= 0 ? '+' : ''}${c[1]}i`;
}

export function isComplexArray(
  data: (number | Complex)[][],
  dtype: string
): data is Complex[][] {
  return dtype.includes('c');
}
