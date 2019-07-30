// Copyright (c) Max Klein.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

// import { ISettingRegistry } from "@jupyterlab/coreutils";

import { IDocumentManager } from '@jupyterlab/docmanager';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { ServerConnection } from '@jupyterlab/services';

import { HdfFileBrowser } from './browser';

import { HdfDrive } from './contents';

import { hdfContentsRequest } from './hdf';

/**
 * Hdf filebrowser plugin state namespace.
 */
const HDF_BROWSER_NAMESPACE = 'hdf-filebrowser';

/**
 * The IDs for the plugins.
 */
const hdf5BrowserPluginId = 'jupyterlab-hdf:browser';
// const hdf5DatasetPluginId = 'jupyterlab-hdf:dataset';

namespace CommandIDs {
  /**
   * Fetch metadata from an hdf5 file
   */
  export const fetchHdfContents = 'hdf:fetchContents';
}

/**
 * Initialization data for the jupyterlab-hdf5 extension.
 */
const hdfBrowserExtension: JupyterFrontEndPlugin<void> = {
  id: hdf5BrowserPluginId,
  requires: [IDocumentManager, IFileBrowserFactory, ILayoutRestorer],

  activate: activateHdfBrowserPlugin,
  autoStart: true
};

/**
 * Activate the file browser.
 */
function activateHdfBrowserPlugin(
  app: JupyterFrontEnd,
  manager: IDocumentManager,
  factory: IFileBrowserFactory,
  restorer: ILayoutRestorer
  // settingRegistry: ISettingRegistry
): void {
  const { commands } = app;

  // Add the Hdf backend to the contents manager.
  const drive = new HdfDrive(app.docRegistry);
  manager.services.contents.addDrive(drive);

  // Create the embedded filebrowser. Hdf files likely
  // don't need as often of a refresh interval as standard
  // filesystem dirs, so we give a 5 second refresh interval.
  const browser = factory.createFileBrowser(HDF_BROWSER_NAMESPACE, {
    driveName: drive.name,
    refreshInterval: 5000
  });

  const hdfBrowser = new HdfFileBrowser(browser, drive);

  hdfBrowser.title.iconClass = 'jp-HdfIcon jp-SideBar-tabIcon';
  hdfBrowser.title.caption = 'Browse Hdf';

  hdfBrowser.id = 'hdf-file-browser';

  // Add the file browser widget to the application restorer.
  restorer.add(hdfBrowser, HDF_BROWSER_NAMESPACE);
  app.shell.add(hdfBrowser, 'left', { rank: 103 });

  // Settings for the notebook server.
  const serverSettings = ServerConnection.makeSettings();

  commands.addCommand(CommandIDs.fetchHdfContents, {
    execute: args => {
      const fpath = args['fpath'] as string;
      const uri = (args['uri'] as string) || '/';
      const row = (args['row'] as number[]) || [100];
      const col = (args['col'] as number[]) || [100];

      return hdfContentsRequest({ fpath, uri, row, col }, serverSettings);
    },
    label: 'For an HDF5 file at `fpath`, fetch the contents at `uri`'
  });

  return;
}

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [hdfBrowserExtension];
export default plugins;
