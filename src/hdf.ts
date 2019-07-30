// Copyright (c) Max Klein.
// Distributed under the terms of the Modified BSD License.

/**
 * Typings representing contents from the Hdf
 */
export class HdfContents {
  /**
   * The type of the file.
   */
  type: 'dataset' | 'group';

  /**
   * The name of the file.
   */
  name: string;

  /**
   * The path of the file in the repository.
   */
  uri: string;
}

/**
 * Typings representing hdf dataset contents
 */
export class HdfDatasetContents extends HdfContents {
  /**
   * The type of the contents.
   */
  type: 'dataset';

  /**
   * The actual base64 encoded contents.
   */
  content?: string;
}

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

/**
 * Typings representing directory contents
 */
export type HdfDirectoryListing = HdfContents[];
