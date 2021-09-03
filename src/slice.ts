// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

export interface ISlice {
  start: number;
  stop?: number | null;
  step: number;
}

/**
 * analogous to the python `slice` constructor
 */
export function slice(
  start: number,
  stop?: number | null,
  step: number | null = null
): ISlice {
  if (stop === undefined) {
    return { start: 0, stop: start, step: 1 };
  }

  return { start, stop, step: step === null ? 1 : step };
}

export function allSlice(): ISlice {
  return slice(0, null);
}

export function noneSlice(): ISlice {
  return slice(0, 0);
}

const allSlices: ISlice[] = [allSlice(), allSlice()];
const noneSlices: ISlice[] = [noneSlice(), noneSlice()];

export function parseSlices(strSlices: string): ISlice[] {
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
        slices.push(slice(start, start + 1));
      } else if (strSliceArr.length === 2 || strSliceArr.length === 3) {
        // ignore strides
        slices.push(slice(start, parseInt(strSliceArr[1])));
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
}
