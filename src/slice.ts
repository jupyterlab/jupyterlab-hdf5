// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

export interface ISlice {
  start: number | null;
  stop?: number | null;
  step?: number | null;
}

const allSlices: ISlice[] = [
  { start: null, stop: null },
  { start: null, stop: null }
];
const noneSlices: ISlice[] = [
  { start: 0, stop: 0 },
  { start: 0, stop: 0 }
];

export const parseSlices = (strSlices: string): ISlice[] => {
  if (!strSlices) {
    return allSlices;
  }

  const slices = strSlices
    .split(/\s*,\s*/)
    .map(dim => dim.split(/\s*:\s*/))
    .reduce((slices: ISlice[], strSliceArr: string[]) => {
      const start = parseInt(strSliceArr[0]);

      if (strSliceArr.length === 1 && start) {
        // single index in place of a slice
        slices.push({ start, stop: start + 1 });
      } else if (strSliceArr.length === 2 || strSliceArr.length === 3) {
        // ignore strides
        slices.push({ start, stop: parseInt(strSliceArr[1]) });
      }
      return slices;
    }, []);

  if (slices.length != 2 || !slices[0] || !slices[1]) {
    // invalidate the slices
    console.warn(
      `Error parsing slices: invalid slices string input. strSlices: "${strSlices}"`
    );

    return [...noneSlices];
  }

  return slices;
};
