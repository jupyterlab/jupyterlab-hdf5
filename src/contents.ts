// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Signal, ISignal } from '@phosphor/signaling';

import { PathExt, URLExt } from '@jupyterlab/coreutils';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { Contents, ServerConnection } from '@jupyterlab/services';

import { HdfContents, HdfDirectoryListing } from './hdf';

import { metadHdfRequest } from './meta';

/**
 * A Contents.IDrive implementation that serves as a read-only
 * view onto GitHub repositories.
 */
export class HdfDrive implements Contents.IDrive {
  /**
   * Construct a new drive object.
   *
   * @param options - The options used to initialize the object.
   */
  constructor(registry: DocumentRegistry) {
    this._serverSettings = ServerConnection.makeSettings();
  }

  /**
   * The name of the drive.
   */
  get name(): 'Hdf' {
    return 'Hdf';
  }

  /**
   * State for whether the file is valid.
   */
  get validFile(): boolean {
    return this._validFile;
  }

  /**
   * Settings for the notebook server.
   */
  readonly serverSettings: ServerConnection.ISettings;

  /**
   * A signal emitted when a file operation takes place.
   */
  get fileChanged(): ISignal<this, Contents.IChangedArgs> {
    return this._fileChanged;
  }

  /**
   * Test whether the manager has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources held by the manager.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
  }

  /**
   * The GitHub base URL
   */
  get baseUrl(): string {
    return this._baseUrl;
  }

  /**
   * The GitHub base URL is set by the settingsRegistry change hook
   */
  set baseUrl(url: string) {
    this._baseUrl = url;
  }

  /**
   * The GitHub access token
   */
  get accessToken(): string | null | undefined {
    return this._accessToken;
  }

  /**
   * The GitHub access token is set by the settingsRegistry change hook
   */
  set accessToken(token: string | null | undefined) {
    this._accessToken = token;
  }

  /**
   * Get a file or directory.
   *
   * @param path: The path to the file.
   *
   * @param options: The options used to fetch the file.
   *
   * @returns A promise which resolves with the file content.
   */
  get(
    path: string,
    options?: HdfDrive.IFetchOptions
  ): Promise<Contents.IModel> {
    const resource = HdfDrive.parsePath(path, options);

    if (!resource.fpath) {
      return Promise.resolve(Private.dummyDirectory);
    }

    return metadHdfRequest(resource.fpath, resource.uri, this._serverSettings)
      .then(contents => {
        this._validFile = true;
        return Private.hdfContentsToJupyterContents(
          path,
          contents,
          this._fileTypeForPath
        );
      })
      .catch((err: ServerConnection.ResponseError) => {
        this._validFile = false;
        if (err.response.status === 403) {
          console.warn(err.message);
          return Private.dummyDirectory;
        } else {
          console.error(err.message);
          return Promise.reject(err);
        }
      });
  }

  /**
   * Get an encoded download url given a file path.
   *
   * @param path - An absolute POSIX file path on the server.
   *
   * #### Notes
   * It is expected that the path contains no relative paths,
   * use [[ContentsManager.getAbsolutePath]] to get an absolute
   * path if necessary.
   */
  getDownloadUrl(path: string): Promise<string> {
    // Parse the path into user/repo/path
    // const resource = parsePath(path);

    return Promise.resolve(
      URLExt.join(this._serverSettings.baseUrl, 'hdf', 'metadata', path)
    );
  }

  /**
   * Create a new untitled file or directory in the specified directory path.
   *
   * @param options: The options used to create the file.
   *
   * @returns A promise which resolves with the created file content when the
   *    file is created.
   */
  newUntitled(options: Contents.ICreateOptions = {}): Promise<Contents.IModel> {
    return Promise.reject('Hdf file is read only');
  }

  /**
   * Delete a file.
   *
   * @param path - The path to the file.
   *
   * @returns A promise which resolves when the file is deleted.
   */
  delete(path: string): Promise<void> {
    return Promise.reject('Hdf file is read only');
  }

  /**
   * Rename a file or directory.
   *
   * @param path - The original file path.
   *
   * @param newPath - The new file path.
   *
   * @returns A promise which resolves with the new file contents model when
   *   the file is renamed.
   */
  rename(path: string, newPath: string): Promise<Contents.IModel> {
    return Promise.reject('Hdf file is read only');
  }

  /**
   * Save a file.
   *
   * @param path - The desired file path.
   *
   * @param options - Optional overrides to the model.
   *
   * @returns A promise which resolves with the file content model when the
   *   file is saved.
   */
  save(
    path: string,
    options: Partial<Contents.IModel>
  ): Promise<Contents.IModel> {
    return Promise.reject('Hdf file is read only');
  }

  /**
   * Copy a file into a given directory.
   *
   * @param path - The original file path.
   *
   * @param toDir - The destination directory path.
   *
   * @returns A promise which resolves with the new contents model when the
   *  file is copied.
   */
  copy(fromFile: string, toDir: string): Promise<Contents.IModel> {
    return Promise.reject('Hdf file is read only');
  }

  /**
   * Create a checkpoint for a file.
   *
   * @param path - The path of the file.
   *
   * @returns A promise which resolves with the new checkpoint model when the
   *   checkpoint is created.
   */
  createCheckpoint(path: string): Promise<Contents.ICheckpointModel> {
    return Promise.reject('Hdf file is read only');
  }

  /**
   * List available checkpoints for a file.
   *
   * @param path - The path of the file.
   *
   * @returns A promise which resolves with a list of checkpoint models for
   *    the file.
   */
  listCheckpoints(path: string): Promise<Contents.ICheckpointModel[]> {
    return Promise.resolve([]);
  }

  /**
   * Restore a file to a known checkpoint state.
   *
   * @param path - The path of the file.
   *
   * @param checkpointID - The id of the checkpoint to restore.
   *
   * @returns A promise which resolves when the checkpoint is restored.
   */
  restoreCheckpoint(path: string, checkpointID: string): Promise<void> {
    return Promise.reject('Hdf file is read only');
  }

  /**
   * Delete a checkpoint for a file.
   *
   * @param path - The path of the file.
   *
   * @param checkpointID - The id of the checkpoint to delete.
   *
   * @returns A promise which resolves when the checkpoint is deleted.
   */
  deleteCheckpoint(path: string, checkpointID: string): Promise<void> {
    return Promise.reject('Read only');
  }

  // /**
  //  * If a file is too large (> 1Mb), we need to access it over the
  //  * GitHub Git Data API.
  //  */
  // private _getBlob(path: string): Promise<Contents.IModel> {
  //   let blobData: GitHubFileContents;
  //   // Get the contents of the parent directory so that we can
  //   // get the sha of the blob.
  //   const resource = parsePath(path);
  //   const dirname = PathExt.dirname(resource.path);
  //   const dirApiPath = URLExt.encodeParts(
  //     URLExt.join(
  //       "repos",
  //       resource.user,
  //       resource.repository,
  //       "contents",
  //       dirname
  //     )
  //   );
  //   return this._apiRequest<GitHubDirectoryListing>(dirApiPath)
  //     .then(dirContents => {
  //       for (let item of dirContents) {
  //         if (item.path === resource.path) {
  //           blobData = item as GitHubFileContents;
  //           return item.sha;
  //         }
  //       }
  //       throw Error("Cannot find sha for blob");
  //     })
  //     .then(sha => {
  //       // Once we have the sha, form the api url and make the request.
  //       const blobApiPath = URLExt.encodeParts(
  //         URLExt.join(
  //           "repos",
  //           resource.user,
  //           resource.repository,
  //           "git",
  //           "blobs",
  //           sha
  //         )
  //       );
  //       return this._apiRequest<GitHubBlob>(blobApiPath);
  //     })
  //     .then(blob => {
  //       // Convert the data to a Contents.IModel.
  //       blobData.content = blob.content;
  //       return Private.gitHubContentsToJupyterContents(
  //         path,
  //         blobData,
  //         this._fileTypeForPath
  //       );
  //     });
  // }

  private _baseUrl: string;
  private _accessToken: string | null | undefined;
  private _validFile = false;
  private _serverSettings: ServerConnection.ISettings;
  private _fileTypeForPath: (path: string) => DocumentRegistry.IFileType;
  private _isDisposed = false;
  private _fileChanged = new Signal<this, Contents.IChangedArgs>(this);
}

export namespace HdfDrive {
  export interface IFetchOptions extends Contents.IFetchOptions {
    uri?: string;
  }

  /**
   * Specification for a file in a repository.
   */
  export interface IHdfResource {
    /**
     * The apipath to to the Hdf resource.
     */
    readonly path: string;

    readonly fpath: string;

    readonly uri: string;
  }

  /**
   * Parse a path into a IHdfResource.
   */
  export function parsePath(
    path: string,
    options: IFetchOptions = {}
  ): IHdfResource {
    const parts = path.split('?');
    return {
      path: path,
      fpath: parts[0],
      uri: parts[1] ? URLExt.queryStringToObject(parts[1]).uri : '/'
    };
  }
}

/**
 * Private namespace for utility functions.
 */
namespace Private {
  /**
   * A dummy contents model indicating an invalid or
   * nonexistent repository.
   */
  export const dummyDirectory: Contents.IModel = {
    type: 'directory',
    path: '',
    name: '',
    format: 'json',
    content: [],
    created: '',
    writable: false,
    last_modified: '',
    mimetype: ''
  };

  /**
   * Given a JSON GitHubContents object returned by the GitHub API v3,
   * convert it to the Jupyter Contents.IModel.
   *
   * @param path - the path to the contents model in the repository.
   *
   * @param contents - the GitHubContents object.
   *
   * @param fileTypeForPath - a function that, given a path, returns
   *   a DocumentRegistry.IFileType, used by JupyterLab to identify different
   *   openers, icons, etc.
   *
   * @returns a Contents.IModel object.
   */
  export function hdfContentsToJupyterContents(
    path: string,
    contents: HdfContents | HdfDirectoryListing,
    fileTypeForPath: (path: string) => DocumentRegistry.IFileType
  ): Contents.IModel {
    if (Array.isArray(contents)) {
      // If we have an array, it is a directory of HdfContents.
      // Iterate over that and convert all of the items in the array/
      const fpath = path.split('?')[0];
      return {
        name: PathExt.basename(fpath),
        path: path,
        format: 'json',
        type: 'directory',
        writable: false,
        created: '',
        last_modified: '',
        mimetype: '',
        content: contents.map(c => {
          return hdfContentsToJupyterContents(
            fpath + `?uri=${c.uri}`,
            c,
            fileTypeForPath
          );
        })
      } as Contents.IModel;
    } else if (contents.type === 'dataset') {
      return {
        name: contents.name,
        path: path,
        format: 'json',
        type: 'file',
        created: '',
        writable: false,
        last_modified: '',
        mimetype: '',
        content: null
      };
    } else if (contents.type === 'group') {
      // If it is a directory, convert to that.
      return {
        name: contents.name,
        path: path,
        format: 'json',
        type: 'directory',
        created: '',
        writable: false,
        last_modified: '',
        mimetype: '',
        content: null
      };
    } else {
      throw makeError(
        500,
        `"${contents.name}" has and unexpected type: ${contents.type}`
      );
    }
  }

  // /**
  //  * Given an array of JSON GitHubRepo objects returned by the GitHub API v3,
  //  * convert it to the Jupyter Contents.IModel conforming to a directory of
  //  * those repositories.
  //  *
  //  * @param repo - the GitHubRepo object.
  //  *
  //  * @returns a Contents.IModel object.
  //  */
  // export function reposToDirectory(repos: GitHubRepo[]): Contents.IModel {
  //   // If it is a directory, convert to that.
  //   let content: Contents.IModel[] = repos.map(repo => {
  //     return {
  //       name: repo.name,
  //       path: repo.name,
  //       format: "json",
  //       type: "directory",
  //       created: "",
  //       writable: false,
  //       last_modified: "",
  //       mimetype: "",
  //       content: null
  //     } as Contents.IModel;
  //   });
  //
  //   return {
  //     name: "",
  //     path: "",
  //     format: "json",
  //     type: "directory",
  //     created: "",
  //     last_modified: "",
  //     writable: false,
  //     mimetype: "",
  //     content
  //   };
  // }

  /**
   * Wrap an API error in a hacked-together error object
   * masquerading as an `ServerConnection.ResponseError`.
   */
  export function makeError(
    code: number,
    message: string
  ): ServerConnection.ResponseError {
    const response = new Response(message, {
      status: code,
      statusText: message
    });
    return new ServerConnection.ResponseError(response, message);
  }
}
