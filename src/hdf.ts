// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { PathExt, URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import { JSONObject, PartialJSONObject } from '@lumino/coreutils';
import { Complex } from './complex';

import { HdfResponseError } from './exception';
import { ISlice } from './slice';

/**
 * Hdf mime types
 */
export const HDF_MIME_TYPE = 'application/x-hdf5';
export const HDF_DATASET_MIME_TYPE = `${HDF_MIME_TYPE}.dataset`;
// export const HDF_GROUP_MIME_TYPE = `${HDF_MIME_TYPE}.group`;

/**
 * A helper function that copies an object without any null or undefined props
 */
function filterNull<T>(obj: T): Partial<T> {
  return (Object.entries(obj) as [keyof T, any]).reduce(
    (a, [k, v]) => (v != null ? ((a[k] = v), a) : a),
    {}
  );
}

/**
 * objectToQueryString that excludes parameters with null/undefined values
 */
function objectToQueryString(value: PartialJSONObject) {
  return URLExt.objectToQueryString(filterNull(value));
}

/**
 * A static version of the localPath method from ContentsManager
 */
export function localAbsPath(path: string): string {
  const parts = path.split('/');
  const firstParts = parts[0].split(':');
  if (firstParts.length === 1) {
    return '/' + path;
  }
  return '/' + PathExt.join(firstParts.slice(1).join(':'), ...parts.slice(1));
}

/**
 * Parse a path into hdf contents request parameters.
 */
export function parseHdfQuery(path: string): IContentsParameters {
  // deal with the possibility of leading "Hdf:" drive specifier via localPath
  const parts = localAbsPath(path).split('?');

  // list some defaults in return value, which may be overridden
  // by params in input query string
  return {
    fpath: parts[0],
    uri: '/',
    ...(parts[1] ? URLExt.queryStringToObject(parts[1]) : {}),
  };
}

export function nameFromPath(path: string): string {
  if (path === '' || path === '/') {
    return '/';
  }

  const parts = path.split('/');
  return parts[parts.length - 1];
}

/**
 * make a parameterized request to the `hdf/attrs` api
 */
export function hdfAttrsRequest(
  parameters: IAttrsParameters,
  settings: ServerConnection.ISettings
): Promise<Record<string, AttributeValue>> {
  // allow the query parameters to be optional
  const { fpath, uri } = parameters;

  const fullUrl =
    URLExt.join(settings.baseUrl, 'hdf', 'attrs', fpath).split('?')[0] +
    objectToQueryString({ uri });

  return hdfApiRequest(fullUrl, {}, settings);
}

/**
 * make a parameterized request to the `hdf/contents` api
 */
export function hdfContentsRequest(
  parameters: IContentsParameters,
  settings: ServerConnection.ISettings
): Promise<HdfContents | HdfDirectoryListing> {
  // allow the query parameters to be optional
  const { fpath, uri } = parameters;

  const fullUrl =
    URLExt.join(settings.baseUrl, 'hdf', 'contents', fpath).split('?')[0] +
    objectToQueryString({ uri });

  return hdfApiRequest(fullUrl, {}, settings);
}

/**
 * make a parameterized request to the `hdf/data` api
 */
export function hdfDataRequest(
  parameters: IDataParameters,
  settings: ServerConnection.ISettings
): Promise<number[][] | Complex[][]> {
  // require the uri, row, and col query parameters
  const { fpath, uri, ixstr, min_ndim, subixstr } = parameters;

  const fullUrl =
    URLExt.join(settings.baseUrl, 'hdf', 'data', fpath).split('?')[0] +
    objectToQueryString({ uri, ixstr, min_ndim, subixstr });

  return hdfApiRequest(fullUrl, {}, settings);
}

/**
 * make a parameterized request to the `hdf/meta` api
 */
export function hdfMetaRequest(
  parameters: IMetaParameters,
  settings: ServerConnection.ISettings
): Promise<IMeta> {
  // allow the query parameters to be optional
  const { fpath, uri, ixstr, min_ndim } = parameters;

  const fullUrl =
    URLExt.join(settings.baseUrl, 'hdf', 'meta', fpath).split('?')[0] +
    objectToQueryString({ uri, ixstr, min_ndim });

  return hdfApiRequest(fullUrl, {}, settings);
}

/**
 * Send a parameterized request to the `hdf/snippet` api, and
 * return the result.
 */
export function hdfSnippetRequest(
  parameters: IDataParameters,
  settings: ServerConnection.ISettings
): Promise<string> {
  // require the uri, row, and col query parameters
  const { fpath, uri, ixstr, subixstr } = parameters;

  const fullUrl =
    URLExt.join(settings.baseUrl, 'hdf', 'snippet', fpath).split('?')[0] +
    objectToQueryString({ uri, ixstr, subixstr });

  return hdfApiRequest(fullUrl, {}, settings);
}

/**
 * Send a parameterized request to one of the hdf api endpoints,
 * and return the result.
 */
export async function hdfApiRequest(
  url: string,
  body: JSONObject,
  settings: ServerConnection.ISettings
): Promise<any> {
  const response = await ServerConnection.makeRequest(url, body, settings);
  if (response.status !== 200) {
    const data = await response.text();
    let json;
    if (data.length > 0) {
      try {
        // HTTPError on the python side adds some leading cruft, strip it
        json = JSON.parse(data.substring(data.indexOf('{')));
      } catch (error) {} // eslint-disable-line no-empty
    }

    if (json?.type === 'JhdfError') {
      const { message, debugVars, traceback } = json;
      throw new HdfResponseError({ response, message, debugVars, traceback });
    } else {
      throw new ServerConnection.ResponseError(response, data);
    }
  }
  return response.json();
}

/**
 * common parameters for all hdf api requests
 */
interface IParameters {
  /**
   * path on disk to an hdf5 file
   */
  fpath: string;

  /**
   * path within an hdf5 file to a specific group or dataset
   */
  uri: string;
}

/**
 * parameters for an hdf attributes request
 */
interface IAttrsParameters extends IParameters {}

/**
 * parameters for an hdf contents request
 */
export interface IContentsParameters extends IParameters {}

/**
 * parameters for an hdf array data (ie from a dataset) request
 */
export interface IDataParameters extends IMetaParameters {
  /**
   * string specifying slice of dataset slab to be fetched as array data, using numpy-style index syntax
   */
  subixstr?: string;
}

/**
 * parameters for an hdf metadata request
 */
export interface IMetaParameters extends IParameters {
  /**
   * string specifying dataset slab, using numpy-style index (or "slice") syntax
   */
  ixstr?: string;

  /**
   * promote any shape metadata or array data that is fetched to have at least this many dimensions
   */
  min_ndim?: number;
}

type HdfType = 'dataset' | 'group' | 'soft_link' | 'external_link';

/**
 * typings representing contents from an object in an hdf5 file
 */
interface IHdfBaseContents {
  /**
   * The name of the object.
   */
  name: string;

  /**
   * The type of the object.
   */
  type: HdfType;

  /**
   * The path to the object in the hdf5 file.
   */
  uri: string;
}

interface IHdfDatasetContents extends IHdfBaseContents {
  content: IDatasetMeta;
  type: 'dataset';
}

interface IHdfGroupContents extends IHdfBaseContents {
  content: IGroupMeta;
  type: 'group';
}

interface IHdfExternalLinkContents extends IHdfBaseContents {
  content: IExternalLinkMeta;
  type: 'external_link';
}

interface IHdfSoftLinkContents extends IHdfBaseContents {
  content: ISoftLinkMeta;
  type: 'soft_link';
}

export type HdfContents =
  | IHdfDatasetContents
  | IHdfGroupContents
  | IHdfExternalLinkContents
  | IHdfSoftLinkContents;

/**
 * Typings representing directory contents
 */
export type HdfDirectoryListing = HdfContents[];

export type AttributeValue = any;

interface IAttrMeta {
  name: string;
  dtype: string;
  type: HdfType;
}

interface IBaseMeta {
  attributes: IAttrMeta[];

  name: string;

  type: HdfType;
}

export interface IDatasetMeta extends IBaseMeta {
  dtype: string;

  labels: ISlice[];

  ndim: number;

  shape: number[];

  size: number;

  type: 'dataset';
}

interface IGroupMeta extends IBaseMeta {
  type: 'group';
}

interface ISoftLinkMeta extends IBaseMeta {
  targetUri: string;
  type: 'soft_link';
}

interface IExternalLinkMeta extends IBaseMeta {
  targetUri: string;
  targetFile: string;

  type: 'external_link';
}

export type IMeta =
  | IDatasetMeta
  | IGroupMeta
  | ISoftLinkMeta
  | IExternalLinkMeta;

export function datasetMetaEmpty(): IDatasetMeta {
  return {
    attributes: [],
    dtype: 'int64',
    labels: [],
    name: '',
    ndim: 0,
    shape: [],
    size: 0,
    type: 'dataset',
  };
}
