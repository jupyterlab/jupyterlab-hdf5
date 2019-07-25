// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

/**
 * Typings representing contents from the Hdf
 */
export class HdfContents {
  /**
   * The type of the file.
   */
  type: "dataset" | "group";

  /**
   * The name of the file.
   */
  name: string;

  /**
   * The path of the file in the repository.
   */
  uri: string;
}

// /**
//  * Typings representing file contents
//  */
// export class HdfFileContents extends HdfContents {
//   /**
//    * The type of the contents.
//    */
//   type: 'file';
//
//   /**
//    * Encoding of the content. All files are base64 encoded.
//    */
//   encoding: 'base64';
//
//   /**
//    * The actual base64 encoded contents.
//    */
//   content?: string;
// }
//
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
