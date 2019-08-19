// Copyright (c) Max Klein.
// Distributed under the terms of the Modified BSD License.

import { map, toArray } from '@phosphor/algorithm';

import {
  ILabShell,
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { WidgetTracker } from '@jupyterlab/apputils';

// import { ISettingRegistry } from "@jupyterlab/coreutils";

import { IDocumentManager } from '@jupyterlab/docmanager';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { ServerConnection } from '@jupyterlab/services';

import { HdfFileBrowser } from './browser';

import { HdfDrive } from './contents';

import {
  IHdfDatasetTracker,
  HdfDatasetFactory,
  HdfDatasetWidget
} from './dataset';

import { hdfContentsRequest, IContentsParameters, parseHdfQuery } from './hdf';

/**
 * Hdf plugins state namespace.
 */
const HDF_BROWSER_NAMESPACE = 'hdf-file-browser';
const HDF_FILE_BROWSER_NAMESPACE = 'hdf-filebrowser';
const HDF_DATASET_NAMESPACE = 'hdf-dataset';

/**
 * The IDs for the plugins.
 */
const hdf5BrowserPluginId = 'jupyterlab-hdf:browser';
const hdf5DatasetPluginId = 'jupyterlab-hdf:dataset';

/**
 * Hdf icon classnames
 */
const HDF_ICON = 'jp-HdfIcon';
const HDF_DATASET_ICON = 'jp-MaterialIcon jp-HdfDatasetIcon';

namespace CommandIDs {
  /**
   * Fetch metadata from an hdf5 file
   */
  export const fetchContents = 'hdf:fetch-contents';

  export const openInBrowser = 'hdf:open-in-browser';
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
  const { createFileBrowser, tracker } = browserFactory;
  const { commands } = app;

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
  hdfBrowser.title.caption = 'Browse Hdf';

  hdfBrowser.id = HDF_BROWSER_NAMESPACE;

  // Add the file browser widget to the application restorer.
  restorer.add(hdfBrowser, HDF_FILE_BROWSER_NAMESPACE);
  app.shell.add(hdfBrowser, 'left', { rank: 103 });

  // Settings for the notebook server.
  const serverSettings = ServerConnection.makeSettings();

  commands.addCommand(CommandIDs.fetchContents, {
    execute: args => {
      let params: IContentsParameters = {
        fpath: args['fpath'] as string,
        uri: args['uri'] as string
      };
      if (args['col']) {
        params.col = args['col'] as number[];
      }
      if (args['row']) {
        params.row = args['row'] as number[];
      }

      return hdfContentsRequest(params, serverSettings);
    },
    label: 'For an HDF5 file at `fpath`, fetch the contents at `uri`'
  });

  commands.addCommand(CommandIDs.openInBrowser, {
    label: 'Open as HDF5',
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

  // matches all filebrowser items
  const selectorDefaultItem = '#filebrowser .jp-DirListing-item[data-isdir]';

  app.contextMenu.addItem({
    command: CommandIDs.openInBrowser,
    selector: selectorDefaultItem,
    rank: 3
  });

  return;
}

/**
 * The HTML file handler extension.
 */
const hdfDatasetPlugin: JupyterFrontEndPlugin<IHdfDatasetTracker> = {
  activate: activateHdfDatasetPlugin,
  id: hdf5DatasetPluginId,
  provides: IHdfDatasetTracker,
  optional: [ILayoutRestorer],
  autoStart: true
};

/**
 * Activate the HTMLViewer extension.
 */
function activateHdfDatasetPlugin(
  app: JupyterFrontEnd,
  restorer: ILayoutRestorer | null
): IHdfDatasetTracker {
  // Add an hdf dataset file type to the docregistry.
  const ft: DocumentRegistry.IFileType = {
    name: 'hdf:dataset',
    contentType: 'file',
    fileFormat: 'json',
    displayName: 'HDF Dataset',
    extensions: ['.data'],
    mimeTypes: ['application/x-hdf5.dataset'],
    iconClass: HDF_DATASET_ICON
  };
  app.docRegistry.addFileType(ft);

  // Create a new dataset viewer factory.
  const factory = new HdfDatasetFactory({
    name: 'HDF Dataset',
    fileTypes: ['hdf:dataset'],
    defaultFor: ['hdf:dataset'],
    readOnly: true
  });

  // Create a widget tracker for hdf documents.
  const tracker = new WidgetTracker<HdfDatasetWidget>({
    namespace: HDF_DATASET_NAMESPACE
  });

  // Handle state restoration.
  if (restorer) {
    void restorer.restore(tracker, {
      command: 'docmanager:open',
      args: widget => ({ path: widget.context.path, factory: 'HDF Dataset' }),
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
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [
  hdfBrowserExtension,
  hdfDatasetPlugin
];
export default plugins;
