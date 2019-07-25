import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from "@jupyterlab/application";

// import { ISettingRegistry } from "@jupyterlab/coreutils";

import { IDocumentManager } from "@jupyterlab/docmanager";

import { IFileBrowserFactory } from "@jupyterlab/filebrowser";

import { ServerConnection } from "@jupyterlab/services";

import { HdfFileBrowser } from "./browser";

import { HdfDrive } from "./contents";

import { metadHdfRequest } from "./meta";

/**
 * Hdf filebrowser plugin state namespace.
 */
const NAMESPACE = "hdf-filebrowser";

/**
 * The ID for the plugin.
 */
const hdf5PluginId = "jupyterlab-hdf:plugin";

namespace CommandIDs {
  /**
   * Fetch metadata from an hdf5 file
   */
  export const fetchMetaHdf = "hdf:fetchMeta";
}

/**
 * Initialization data for the jupyterlab-hdf5 extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: hdf5PluginId,
  autoStart: true,
  activate: activateHdfPlugin
};

export default extension;

/**
 * Activate the file browser.
 */
function activateHdfPlugin(
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

  // Create the embedded filebrowser. Hdf repos likely
  // don't need as often of a refresh interval as normal ones,
  // and rate-limiting can be an issue, so we give a 5 minute
  // refresh interval.
  const browser = factory.createFileBrowser(NAMESPACE, {
    driveName: drive.name,
    refreshInterval: 300000
  });

  const hdfBrowser = new HdfFileBrowser(browser, drive);

  hdfBrowser.title.iconClass = "jp-Hdf-icon jp-SideBar-tabIcon";
  hdfBrowser.title.caption = "Browse Hdf";

  hdfBrowser.id = NAMESPACE;

  // Add the file browser widget to the application restorer.
  restorer.add(hdfBrowser, NAMESPACE);
  app.shell.add(hdfBrowser, "left", { rank: 102 });

  // Settings for the notebook server.
  const serverSettings = ServerConnection.makeSettings();

  commands.addCommand(CommandIDs.fetchMetaHdf, {
    execute: args => {
      const path = args["path"] as string;
      const meta = metadHdfRequest(path, serverSettings);
      console.log(meta);
    },
    label: "Fetch HDF5 metadata"
  });

  return;
}
