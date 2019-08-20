import { from } from "rxjs";

import { map } from "rxjs/operators";

import { ServerConnection } from "@jupyterlab/services";

import {
  createConverter,
  Registry,
  relativeNestedDataType,
  resolveDataType,
  resolveExtensionConverter
} from "@jupyterlab/dataregistry";

import { widgetDataType } from "@jupyterlab/dataregistry-extension";

import {
  HDF_MIME_TYPE,
  hdfContentsRequest,
  HdfDirectoryListing,
  parseHdfRegistryUrl
} from "./hdf";

import { createHdfGrid } from "./dataset";

/**
 * Settings for the notebook server.
 */
const serverSettings = ServerConnection.makeSettings();

const groupConverter = createConverter(
  { from: resolveDataType, to: relativeNestedDataType },
  ({ url }) => {
    const params = parseHdfRegistryUrl(url);
    if (!params) {
      return null;
    }

    const { fpath, uri, type } = params;
    if (type === "group") {
      return {
        data: from(hdfContentsRequest({ fpath, uri }, serverSettings)).pipe(
          map((hdfContents: HdfDirectoryListing) =>
            hdfContents.map(
              hdfContent =>
                `?uri=${hdfContent.uri}&type=${hdfContent.type}&content=${hdfContent.content}`
            )
          )
        ),
        type: undefined
      };
    }

    return null;
  }
);

const datasetConverter = createConverter(
  { from: resolveDataType, to: widgetDataType },
  ({ url }) => {
    const params = parseHdfRegistryUrl(url);
    if (!params) {
      return null;
    }

    const { fpath, uri, type } = params;
    if (type === "dataset") {
      return {
        data: () => createHdfGrid({ fpath, uri }),
        type: "Grid"
      };
    }

    return null;
  }
);

export function addHdfConverters(dataRegistry: Registry): void {
  dataRegistry.addConverter(
    resolveExtensionConverter(".hdf5", HDF_MIME_TYPE),
    groupConverter,
    datasetConverter
  );
}
