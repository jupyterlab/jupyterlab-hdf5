// Copyright (c) Max Klein.
// Distributed under the terms of the Modified BSD License.

import { URLExt } from '@jupyterlab/coreutils';

import { ServerConnection } from '@jupyterlab/services';

/**
 * Parse a path into hdf contents request parameters.
 */
export function parseHdfQuery(path: string): IContentsParameters {
  const parts = path.split('?');

  return {
    fpath: parts[0],
    uri: '/',
    row: [100],
    col: [100],
    ...(parts[1] ? URLExt.queryStringToObject(parts[1]) : {})
  };
}

/**
 * Send a parameterized request to the `hdf/contents` api, and
 * return the result.
 */
export function hdfContentsRequest(
  parameters: IContentsParameters,
  settings: ServerConnection.ISettings
): Promise<HdfDirectoryListing> {
  const { fpath, ...rest } = parameters;

  const fullUrl =
    URLExt.join(settings.baseUrl, 'hdf', 'contents', fpath).split('?')[0] +
    URLExt.objectToQueryString({ ...rest });

  return ServerConnection.makeRequest(fullUrl, {}, settings).then(response => {
    if (response.status !== 200) {
      return response.text().then(data => {
        throw new ServerConnection.ResponseError(response, data);
      });
    }
    return response.json();
  });
}

/**
 * The parameters that make up the input of an hdf contents request.
 */
export interface IContentsParameters {
  /**
   * Path on disk to an HDF5 file.
   */
  fpath: string;

  /**
   * Path within an HDF5 file to a specific group or dataset.
   */
  uri?: string;

  /**
   * Row slice. Up to 3 integers, same syntax as for Python `slice` built-in.
   */
  row?: number[];

  /**
   * Column slice. Up to 3 integers, same syntax as for Python `slice` built-in.
   */
  col?: number[];
}

/**
 * Typings representing contents from an object in an hdf5 file.
 */
export class HdfContents {
  /**
   * The type of the object.
   */
  type: 'dataset' | 'group';

  /**
   * The name of the object.
   */
  name: string;

  /**
   * The path to the object in the hdf5 file.
   */
  uri: string;

  /**
   * If object is a dataset, all of its metadata encoded as a JSON string.
   */
  content?: string;

  /**
   * If object is a dataset, some or all of it's data encoded as a JSON string.
   */
  data?: string;
}

/**
 * Typings representing directory contents
 */
export type HdfDirectoryListing = HdfContents[];

// /**
//  * Typings representing a directory from the Hdf
//  */
// export class HdfDirectoryContents extends HdfContents {
//   /**
//    * The type of the contents.
//    */
//   type: 'dir';
// }
//
// /**
//  * Typings representing a blob from the Hdf
//  */
// export class HdfBlob {
//   /**
//    * The base64-encoded contents of the file.
//    */
//   content: string;
//
//   /**
//    * The encoding of the contents. Always base64.
//    */
//   encoding: 'base64';
//
//   /**
//    * The URL for the blob.
//    */
//   url: string;
//
//   /**
//    * The unique sha for the blob.
//    */
//   sha: string;
//
//   /**
//    * The size of the blob, in bytes.
//    */
//   size: number;
// }
