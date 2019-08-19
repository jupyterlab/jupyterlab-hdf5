// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Signal, ISignal } from '@phosphor/signaling';

import { PathExt, URLExt } from '@jupyterlab/coreutils';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { Contents, ServerConnection } from '@jupyterlab/services';

import {
  hdfContentsRequest,
  HdfContents,
  HdfDirectoryListing,
  parseHdfQuery
} from './hdf';

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
    const params = parseHdfQuery(path);

    // set some default parameter values
    if (!params.uri) {
      params.uri = '/';
    }
    if (!params.row) {
      params.row = [100];
    }
    if (!params.col) {
      params.col = [100];
    }

    if (!params.fpath || !PathExt.normalize(params.fpath)) {
      return Promise.resolve(Private.dummyDirectory);
    }

    return hdfContentsRequest(params, this._serverSettings)
      .then(contents => {
        this._validFile = true;
        return Private.hdfContentsToJupyterContents(path, contents);
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
      URLExt.join(this._serverSettings.baseUrl, 'hdf', 'contents', path)
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

  private _validFile = false;
  private _serverSettings: ServerConnection.ISettings;
  private _isDisposed = false;
  private _fileChanged = new Signal<this, Contents.IChangedArgs>(this);
}

export namespace HdfDrive {
  export interface IFetchOptions extends Contents.IFetchOptions {
    uri?: string;
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
   * Given a JSON HdfContents object returned by our Hdf api,
   * convert it to the Jupyter Contents.IModel.
   *
   * @param path - the path to the contents model in the repository.
   *
   * @param contents - the HdfContents object.
   *
   * @returns a Contents.IModel object.
   */
  export function hdfContentsToJupyterContents(
    path: string,
    contents: HdfContents | HdfDirectoryListing
  ): Contents.IModel {
    if (Array.isArray(contents)) {
      // If we have an array, it is a directory of HdfContents.
      // Iterate over that and convert all of the items in the array
      const { fpath } = parseHdfQuery(path);
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
          return hdfContentsToJupyterContents(fpath + `?uri=${c.uri}`, c);
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
        mimetype: 'application/x-hdf5.dataset',
        content: contents.content
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
