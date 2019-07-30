// Copyright (c) Max Klein.
// Distributed under the terms of the Modified BSD License.

import { URLExt } from '@jupyterlab/coreutils';

import { ServerConnection } from '@jupyterlab/services';

import { HdfDirectoryListing } from './hdf';

export function metadHdfRequest(
  fpath: string,
  uri: string,
  settings: ServerConnection.ISettings
): Promise<HdfDirectoryListing> {
  let fullUrl = URLExt.join(settings.baseUrl, 'hdf', 'meta', fpath);

  if (fullUrl.includes('?')) {
    if (uri) {
      fullUrl = fullUrl.split('?')[0] + URLExt.objectToQueryString({ uri });
    }
  } else {
    fullUrl += URLExt.objectToQueryString({ uri });
  }

  return ServerConnection.makeRequest(fullUrl, {}, settings).then(response => {
    if (response.status !== 200) {
      return response.text().then(data => {
        throw new ServerConnection.ResponseError(response, data);
      });
    }
    return response.json();
  });
}
