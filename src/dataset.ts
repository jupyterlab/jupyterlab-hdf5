// Copyright (c) Max Klein.
// Distributed under the terms of the Modified BSD License.

import { PromiseDelegate, Token } from '@phosphor/coreutils';

import { DataGrid, DataModel } from '@phosphor/datagrid';

import { IWidgetTracker, Toolbar, ToolbarButton } from '@jupyterlab/apputils';

import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget,
  IDocumentWidget
} from '@jupyterlab/docregistry';

import { ServerConnection } from '@jupyterlab/services';

import { hdfDataRequest, IDatasetContent, parseHdfQuery } from './hdf';

/**
 * The MIME type for an HDF5 dataset.
 */
export const MIME_TYPE = 'application/x-hdf5.dataset';

/**
 * The CSS class for the data grid widget.
 */
export const HDF_CLASS = 'jp-HdfDataGrid';

/**
 * The CSS class for our HDF5 container.
 */
export const HDF_CONTAINER_CLASS = 'jp-HdfContainer';

class HdfDatasetModel extends DataModel {
  constructor(context: DocumentRegistry.Context) {
    super();

    this._serverSettings = ServerConnection.makeSettings();
    this._context = context;

    void context.ready.then(() => {
      this._onContextReady();
    });
  }

  /**
   * Get the context for the editor widget.
   */
  get context(): DocumentRegistry.Context {
    return this._context;
  }

  /**
   * A promise that resolves when the file editor is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * Handle actions that should be taken when the context is ready.
   */
  private _onContextReady(): void {
    // get the fpath and the uri for this dataset
    const { fpath, uri } = parseHdfQuery(this._context.contentsModel.path);
    this._fpath = fpath;
    this._uri = uri;

    // unpack the content
    const content: IDatasetContent = this._context.model.toJSON() as any;

    this._rowCount = content.shape[0];
    this._colCount = content.shape[1];

    this._blocks[0] = Object();
    this._blocks[0][0] = content.data;

    this.emitChanged({
      type: 'rows-inserted',
      region: 'body',
      index: 0,
      span: this._rowCount
    });
    this.emitChanged({
      type: 'columns-inserted',
      region: 'body',
      index: 0,
      span: this._colCount
    });

    // // Wire signal connections.
    // contextModel.contentChanged.connect(this._onContentChanged, this);

    // Resolve the ready promise.
    this._ready.resolve(undefined);
  }

  rowCount(region: DataModel.RowRegion): number {
    return region === 'body' ? this._rowCount : 1;
  }

  columnCount(region: DataModel.ColumnRegion): number {
    return region === 'body' ? this._colCount : 1;
  }

  data(region: DataModel.CellRegion, row: number, column: number): any {
    if (region === 'row-header') {
      return `${row}`;
    }
    if (region === 'column-header') {
      return `${column}`;
    }
    if (region === 'corner-header') {
      return null;
    }
    const relRow = row % this._blockSize;
    const relCol = column % this._blockSize;
    const rowBlock = (row - relRow) / this._blockSize;
    const colBlock = (column - relCol) / this._blockSize;
    if (this._blocks[rowBlock]) {
      if (this._blocks[rowBlock][colBlock]) {
        // This data has already been loaded.
        return this._blocks[rowBlock][colBlock][relRow][relCol];
      }
    }
    // This data has not yet been loaded. Fetch the block that it is in.
    // When the data is received, this will be updated by emitChanged.
    this._fetchBlock(rowBlock, colBlock);
    return null;
  }

  private _fetchBlock = (rowBlock: number, colBlock: number) => {
    const rowStart: number = rowBlock * this._blockSize;
    const rowStop: number = Math.min(
      rowStart + this._blockSize,
      this._rowCount
    );
    const colStart: number = colBlock * this._blockSize;
    const colStop: number = Math.min(
      colStart + this._blockSize,
      this._colCount
    );

    const params = {
      fpath: this._fpath,
      uri: this._uri,
      col: [colStart, colStop],
      row: [rowStart, rowStop]
    };
    hdfDataRequest(params, this._serverSettings).then(data => {
      if (!this._blocks[rowBlock]) {
        this._blocks[rowBlock] = Object();
      }
      this._blocks[rowBlock][colBlock] = data;
      this.emitChanged({
        type: 'cells-changed',
        region: 'body',
        rowIndex: rowBlock * this._blockSize,
        columnIndex: colBlock * this._blockSize,
        rowSpan: this._blockSize,
        columnSpan: this._blockSize
      });
    });
  };

  protected _context: DocumentRegistry.Context;
  private _fpath: string = '';
  private _ready = new PromiseDelegate<void>();
  private _serverSettings: ServerConnection.ISettings;
  private _uri: string = '';

  private _blocks: any = Object();
  private _blockSize: number = 100;
  private _colCount: number = 0;
  private _rowCount: number = 0;
}

/**
 * A document widget for HDF content widgets.
 */
export class HdfDatasetWidget extends DocumentWidget<DataGrid>
  implements IDocumentWidget<DataGrid> {
  constructor(context: DocumentRegistry.Context) {
    const content = new DataGrid();
    content.model = new HdfDatasetModel(context);
    const toolbar = Private.createToolbar(content);
    const reveal = context.ready;
    super({ content, context, reveal, toolbar });
  }
}

/**
 * A widget factory for HDF5 data grids.
 */
export class HdfDatasetFactory extends ABCWidgetFactory<HdfDatasetWidget> {
  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(
    context: DocumentRegistry.Context
  ): HdfDatasetWidget {
    return new HdfDatasetWidget(context);
  }
}

/**
 * A class that tracks hdf5 viewer widgets.
 */
export interface IHdfDatasetTracker extends IWidgetTracker<HdfDatasetWidget> {}

export const IHdfDatasetTracker = new Token<IHdfDatasetTracker>(
  'jupyterlab-hdf:IHdfDatasetTracker'
);

/**
 * A namespace for HDFViewer statics.
 */
export namespace HDFViewer {
  /**
   * The options for a SyncTeX edit command,
   * mapping the hdf position to an editor position.
   */
  export interface IPosition {
    /**
     * The page of the hdf.
     */
    page: number;

    /**
     * The x-position on the page, in pts, where
     * the HDF is assumed to be 72dpi.
     */
    x: number;

    /**
     * The y-position on the page, in pts, where
     * the HDF is assumed to be 72dpi.
     */
    y: number;
  }
}

/**
 * A namespace for HDF widget private data.
 */
namespace Private {
  /**
   * Create the node for the HDF widget.
   */
  export function createNode(): HTMLElement {
    let node = document.createElement('div');
    node.className = HDF_CONTAINER_CLASS;
    let hdf = document.createElement('div');
    hdf.className = HDF_CLASS;
    node.appendChild(hdf);
    node.tabIndex = -1;
    return node;
  }

  /**
   * Create the toolbar for the HDF viewer.
   */
  export function createToolbar(hdfViewer: any): Toolbar<ToolbarButton> {
    const toolbar = new Toolbar();

    toolbar.addClass('jp-Toolbar');
    toolbar.addClass('jp-HDF-toolbar');

    // toolbar.addItem(
    //   'previous',
    //   new ToolbarButton({
    //     iconClassName: 'jp-PreviousIcon jp-Icon jp-Icon-16',
    //     onClick: () => {
    //       hdfViewer.currentPageNumber = Math.max(
    //         hdfViewer.currentPageNumber - 1,
    //         1
    //       );
    //     },
    //     tooltip: 'Previous Page'
    //   })
    // );
    // toolbar.addItem(
    //   'next',
    //   new ToolbarButton({
    //     iconClassName: 'jp-NextIcon jp-Icon jp-Icon-16',
    //     onClick: () => {
    //       hdfViewer.currentPageNumber = Math.min(
    //         hdfViewer.currentPageNumber + 1,
    //         hdfViewer.pagesCount
    //       );
    //     },
    //     tooltip: 'Next Page'
    //   })
    // );
    //
    // toolbar.addItem('spacer', Toolbar.createSpacerItem());

    return toolbar;
  }
}
