// Copyright (c) Max Klein.
// Distributed under the terms of the Modified BSD License.

import { PathExt, URLExt } from "@jupyterlab/coreutils";

import { ServerConnection } from "@jupyterlab/services";

/**
 * Hdf mime types
 */
export const HDF_MIME_TYPE = "application/x-hdf5";
export const HDF_DATASET_MIME_TYPE = `${HDF_MIME_TYPE}.dataset`;
// export const HDF_GROUP_MIME_TYPE = `${HDF_MIME_TYPE}.group`;

/**
 * A static version of the localPath method from ContentsManager
 */
export function localAbsPath(path: string): string {
  const parts = path.split("/");
  const firstParts = parts[0].split(":");
  if (firstParts.length === 1) {
    return "/" + path;
  }
  return "/" + PathExt.join(firstParts.slice(1).join(":"), ...parts.slice(1));
}

/**
 * Parse a path into hdf contents request parameters.
 */
export function parseHdfQuery(path: string): IContentsParameters {
  // deal with the possibility of leading "Hdf:" drive specifier via localPath
  const parts = localAbsPath(path).split("?");

  // list some defaults in return value, which may be overridden
  // by params in input query string
  return {
    fpath: parts[0],
    uri: "/",
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
): Promise<HdfDirectoryListing | HdfContents> {
  // allow the query parameters to be optional
  const { fpath, ...rest } = parameters;

  const fullUrl =
    URLExt.join(settings.baseUrl, "hdf", "contents", fpath).split("?")[0] +
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
 * Send a parameterized request to the `hdf/data` api, and
 * return the result.
 */
export function hdfDataRequest(
  parameters: IContentsParameters,
  settings: ServerConnection.ISettings
): Promise<number[][]> {
  // require the uri query parameter, select is optional
  const { fpath, uri, ...select } = parameters;

  const fullUrl =
    URLExt.join(settings.baseUrl, "hdf", "data", fpath).split("?")[0] +
    URLExt.objectToQueryString({ uri, ...select });

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
  uri: string;

  /**
   * String representing an array of slices that determine a
   * hyperslab selection of an HDF5 dataset. Syntax and semantics
   * matches that of h5py's Dataset indexing.
   */
  select?: string;
}

/**
 * Typings representing contents from an object in an hdf5 file.
 */
export class HdfContents {
  /**
   * The type of the object.
   */
  type: "dataset" | "group";

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
  content?: IDatasetContent;
}

export interface IDatasetContent {
  dtype: string;

  ndim: number;

  shape: number[];

  attrs: { [key: string]: any };

  data?: number[][];
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
