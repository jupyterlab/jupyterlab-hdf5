// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { from, of } from "rxjs";

import { map } from "rxjs/operators";

import { ServerConnection } from "@jupyterlab/services";

import {
  createConverter,
  relativeNestedDataType,
  resolveDataType
} from "@jupyterlab/dataregistry";

import {
  widgetDataType,
  IRegistry,
  labelDataType
} from "@jupyterlab/dataregistry-extension";

import { HdfContents, hdfContentsRequest, HdfDirectoryListing } from "./hdf";

import { createHdfGrid } from "./dataset";

/**
 * Settings for the notebook server.
 */
const serverSettings = ServerConnection.makeSettings();

export function parseHdfRegistryUrl(url: URL): { fpath: string } & HdfContents {
  if (url.protocol === "file:" && url.pathname.endsWith(".hdf5")) {
    return {
      fpath: url.pathname,
      type: url.searchParams.get("type") === "dataset" ? "dataset" : "group",
      name: url.searchParams.get("name") || "",
      uri: url.searchParams.get("uri") || "/",
      content: JSON.parse(url.searchParams.get("content") || null)
    };
  }
}

const groupConverter = createConverter(
  { from: resolveDataType, to: relativeNestedDataType },
  ({ url }) => {
    const params = parseHdfRegistryUrl(url);
    if (!params) {
      return null;
    }

    const { fpath, uri, type } = params;
    if (type === "group") {
      return from(hdfContentsRequest({ fpath, uri }, serverSettings)).pipe(
        map((hdfContents: HdfDirectoryListing) =>
          hdfContents.map(
            hdfContent =>
              `?uri=${hdfContent.uri}&type=${hdfContent.type}&content=${hdfContent.content}`
          )
        )
      );
    }

    return null;
  }
);

const labelConverter = createConverter(
  { from: resolveDataType, to: labelDataType },
  ({ url }) => {
    const params = parseHdfRegistryUrl(url);
    if (!params) {
      return null;
    }
    // Return the last part of the path as the label
    // or the last part of the file path, if that is empty
    const lastPath = params.uri.split("/").pop();
    const lastFilePath = params.fpath.split("/").pop();
    return of(lastPath || lastFilePath);
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

export function addHdfConverters(dataRegistry: IRegistry): void {
  dataRegistry.addConverter(groupConverter, datasetConverter, labelConverter);
}
