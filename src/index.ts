// Copyright (c) Max Klein.
// Distributed under the terms of the Modified BSD License.

import { map, toArray } from "@phosphor/algorithm";

import {
  ILabShell,
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from "@jupyterlab/application";

import { WidgetTracker } from "@jupyterlab/apputils";

import { PathExt } from "@jupyterlab/coreutils";

import { IDocumentManager } from "@jupyterlab/docmanager";

import { DocumentRegistry } from "@jupyterlab/docregistry";

import { FileBrowser, IFileBrowserFactory } from "@jupyterlab/filebrowser";

import { ServerConnection } from "@jupyterlab/services";

import { IRegistry } from "@jupyterlab/dataregistry-extension";

import { HdfFileBrowser } from "./browser";

import { HdfDrive } from "./contents";

import { addHdfConverters } from "./dataregistry";

import {
  IHdfDatasetDocTracker,
  HdfDatasetDocFactory,
  HdfDatasetDoc
} from "./dataset";

import {
  HDF_DATASET_MIME_TYPE,
  hdfContentsRequest,
  IContentsParameters,
  parseHdfQuery
} from "./hdf";

/**
 * Hdf plugins state namespace.
 */
const HDF_BROWSER_NAMESPACE = "hdf-file-browser";
const HDF_FILE_BROWSER_NAMESPACE = "hdf-filebrowser";
const HDF_DATASET_NAMESPACE = "hdf-dataset";

/**
 * The IDs for the plugins.
 */
const hdf5BrowserPluginId = "jupyterlab-hdf:browser";
const hdf5DatasetPluginId = "jupyterlab-hdf:dataset";
const hdf5DataRegistryPluginId = "jupyterlab-hdf:dataregistry";

/**
 * Hdf icon classnames
 */
const HDF_ICON = "jp-HdfIcon";
const HDF_DATASET_ICON = "jp-MaterialIcon jp-SpreadsheetIcon"; // jp-HdfDatasetIcon;

/**
 * Settings for the notebook server.
 */
const serverSettings = ServerConnection.makeSettings();

namespace CommandIDs {
  /**
   * Fetch metadata from an hdf5 file
   */
  export const fetchContents = "hdf:fetch-contents";

  export const openInBrowser = "hdf:open-in-browser";
}

/**
 * Initialization data for the jupyterlab-hdf5 extension.
 */
const hdfBrowserExtension: JupyterFrontEndPlugin<void> = {
  id: hdf5BrowserPluginId,
  requires: [IDocumentManager, IFileBrowserFactory, ILabShell, ILayoutRestorer],

  activate: activateHdfBrowserPlugin,
  autoStart: true
};

/**
 * The HTML file handler extension.
 */
const hdfDatasetPlugin: JupyterFrontEndPlugin<IHdfDatasetDocTracker> = {
  activate: activateHdfDatasetPlugin,
  id: hdf5DatasetPluginId,
  provides: IHdfDatasetDocTracker,
  optional: [ILayoutRestorer],
  autoStart: true
};

/**
 * Provides hdf5 support for the @jupyterlab/dataregistry
 * extension, if it is installed.
 */
const hdfDataRegistryPlugin: JupyterFrontEndPlugin<void> = {
  activate: activateHdfDataRegistryPlugin,
  id: hdf5DataRegistryPluginId,
  optional: [IRegistry],
  autoStart: true
};

/**
 * Activate the file browser.
 */
function activateHdfBrowserPlugin(
  app: JupyterFrontEnd,
  manager: IDocumentManager,
  browserFactory: IFileBrowserFactory,
  labShell: ILabShell,
  restorer: ILayoutRestorer
  // settingRegistry: ISettingRegistry
): void {
  const { createFileBrowser, defaultBrowser } = browserFactory;

  // Add the Hdf backend to the contents manager.
  const drive = new HdfDrive(app.docRegistry);
  manager.services.contents.addDrive(drive);

  // Create the embedded filebrowser. Hdf files likely
  // don't need as often of a refresh interval as standard
  // filesystem dirs, so we give a 5 second refresh interval.
  const browser = createFileBrowser(HDF_BROWSER_NAMESPACE, {
    driveName: drive.name,
    refreshInterval: 5000
  });

  const hdfBrowser = new HdfFileBrowser(browser, drive);

  hdfBrowser.title.iconClass = `${HDF_ICON} jp-SideBar-tabIcon`;
  hdfBrowser.title.caption = "Browse Hdf";

  hdfBrowser.id = HDF_BROWSER_NAMESPACE;

  // Add the file browser widget to the application restorer.
  restorer.add(hdfBrowser, HDF_FILE_BROWSER_NAMESPACE);
  app.shell.add(hdfBrowser, "left", { rank: 103 });

  addBrowserCommands(app, browserFactory, labShell, hdfBrowser, browser);
  monkeyPatchBrowser(app, defaultBrowser);

  return;
}

function monkeyPatchBrowser(app: JupyterFrontEnd, browser: FileBrowser) {
  const { commands } = app;

  const handleDblClick = async (evt: Event): Promise<void> => {
    const event = evt as MouseEvent;
    // Do nothing if it's not a left mouse press.
    if (event.button !== 0) {
      return;
    }

    // Do nothing if any modifier keys are pressed.
    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
      return;
    }

    // Stop the event propagation.
    event.preventDefault();
    event.stopPropagation();

    const item = browser.modelForClick(event);
    if (!item) {
      return;
    }

    const { contents } = browser.model.manager.services;
    if (PathExt.extname(item.path) === ".hdf5") {
      // special handling for .hdf5 files
      commands.execute(CommandIDs.openInBrowser);
    } else if (item.type === "directory") {
      browser.model
        .cd("/" + contents.localPath(item.path))
        .catch(error => console.error(error));
    } else {
      browser.model.manager.openOrReveal(item.path);
    }
  };

  browser.node.addEventListener("dblclick", handleDblClick, true);
}

function addBrowserCommands(
  app: JupyterFrontEnd,
  browserFactory: IFileBrowserFactory,
  labShell: ILabShell,
  hdfBrowser: HdfFileBrowser,
  browser: FileBrowser
): void {
  const { tracker } = browserFactory;
  const { commands } = app;

  commands.addCommand(CommandIDs.fetchContents, {
    execute: args => {
      let params: IContentsParameters = {
        fpath: args["fpath"] as string,
        uri: args["uri"] as string
      };
      if (args["select"]) {
        params.select = args["select"] as string;
      }
      return hdfContentsRequest(params, serverSettings);
    },
    label: "For an HDF5 file at `fpath`, fetch the contents at `uri`"
  });

  commands.addCommand(CommandIDs.openInBrowser, {
    label: "Open as HDF5",
    execute: args => {
      const widget = tracker.currentWidget;

      if (!widget) {
        return;
      }

      const fpaths = map(widget.selectedItems(), item => {
        const { fpath } = parseHdfQuery(item.path);
        return fpath;
      });

      labShell.activateById(hdfBrowser.id);

      return Promise.all(
        toArray(
          map(fpaths, fpath => {
            return browser.model.cd(fpath);
          })
        )
      );
    }
  });

  // add context menu items for commands

  // // matches all filebrowser items
  // const selectorDefaultItem = "#filebrowser .jp-DirListing-item[data-isdir]";

  // app.contextMenu.addItem({
  //   command: CommandIDs.openInBrowser,
  //   selector: selectorDefaultItem,
  //   rank: 3
  // });

  return;
}

/**
 * Activate the HTMLViewer extension.
 */
function activateHdfDatasetPlugin(
  app: JupyterFrontEnd,
  restorer: ILayoutRestorer | null
): IHdfDatasetDocTracker {
  // Add an hdf dataset file type to the docregistry.
  const ft: DocumentRegistry.IFileType = {
    name: "hdf:dataset",
    contentType: "file",
    fileFormat: "json",
    displayName: "HDF Dataset",
    extensions: [".data"],
    mimeTypes: [HDF_DATASET_MIME_TYPE],
    iconClass: HDF_DATASET_ICON
  };
  app.docRegistry.addFileType(ft);

  // Create a new dataset viewer factory.
  const factory = new HdfDatasetDocFactory({
    name: "HDF Dataset",
    fileTypes: ["hdf:dataset"],
    defaultFor: ["hdf:dataset"],
    readOnly: true
  });

  // Create a widget tracker for hdf documents.
  const tracker = new WidgetTracker<HdfDatasetDoc>({
    namespace: HDF_DATASET_NAMESPACE
  });

  // Handle state restoration.
  if (restorer) {
    void restorer.restore(tracker, {
      command: "docmanager:open",
      args: widget => ({ path: widget.context.path, factory: "HDF Dataset" }),
      name: widget => widget.context.path
    });
  }

  app.docRegistry.addWidgetFactory(factory);
  factory.widgetCreated.connect((sender, widget) => {
    // Track the widget.
    void tracker.add(widget);
    // Notify the widget tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => {
      void tracker.save(widget);
    });

    widget.title.iconClass = ft.iconClass;
    widget.title.iconLabel = ft.iconLabel;
  });

  return tracker;
}

/**
 * Activate the HTMLViewer extension.
 */
function activateHdfDataRegistryPlugin(
  app: JupyterFrontEnd,
  dataRegistry: IRegistry | null
): void {
  if (!dataRegistry) {
    // bail
    return;
  }

  addHdfConverters(dataRegistry);
}

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [
  hdfBrowserExtension,
  hdfDatasetPlugin,
  hdfDataRegistryPlugin
];
export default plugins;
