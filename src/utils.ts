import { IDatasetMeta } from './hdf';
import { ModalResult } from './exception';

export function isDatasetMeta(
  meta: IDatasetMeta | ModalResult
): meta is IDatasetMeta {
  return Object.getOwnPropertyNames(meta).includes('labels');
}
