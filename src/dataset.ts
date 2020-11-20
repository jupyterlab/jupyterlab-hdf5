// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { PromiseDelegate, Token } from "@lumino/coreutils";

import {
  BasicKeyHandler,
  BasicMouseHandler,
  BasicSelectionModel,
  DataGrid,
  DataModel
} from "@lumino/datagrid";

import { Signal } from "@lumino/signaling";

import {
  IWidgetTracker,
  MainAreaWidget,
  Toolbar,
  ToolbarButton
} from "@jupyterlab/apputils";

import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget,
  IDocumentWidget
} from "@jupyterlab/docregistry";

import { ServerConnection } from "@jupyterlab/services";

import { HdfResponseError, modalHdfError } from "./exception";

import {
  HdfContents,
  hdfContentsRequest,
  hdfDataRequest,
  IContentsParameters,
  IDatasetMeta,
  parseHdfQuery
} from "./hdf";

import { noneSlice, slice } from "./slice";

import { IxInput } from "./toolbar";

/**
 * The CSS class for the data grid widget.
 */
export const HDF_CLASS = "jhdf-dataGrid";

/**
 * The CSS class for our HDF5 container.
 */
export const HDF_CONTAINER_CLASS = "jhdf-container";

/**
 * Base implementation of the hdf dataset model.
 */
export class HdfDatasetModelBase extends DataModel {
  constructor() {
    super();

    this._serverSettings = ServerConnection.makeSettings();
  }

  /**
   * Handle actions that should be taken when the context is ready.
   */
  init({
    fpath,
    uri,
    meta
  }: {
    fpath: string;
    uri: string;
    meta: IDatasetMeta;
  }): void {
    this._fpath = fpath;
    this._uri = uri;

    this._ixstr = meta.ixstr;

    // Refresh wrt the newly set ix and then resolve the ready promise.
    this._refresh(meta).then(() => {
      this._ready.resolve(undefined);
    });
  }

  data(region: DataModel.CellRegion, row: number, col: number): any {
    if (region === "row-header") {
      return `${this._rowslice.start + row * this._rowslice.step}`;
    }
    if (region === "column-header") {
      return `${this._colslice.start + col * this._colslice.step}`;
    }
    if (region === "corner-header") {
      return null;
    }

    const relRow = row % this._blockSize;
    const relCol = col % this._blockSize;
    const rowBlock = (row - relRow) / this._blockSize;
    const colBlock = (col - relCol) / this._blockSize;
    if (this._blocks[rowBlock]) {
      const block = this._blocks[rowBlock][colBlock];
      if (block !== "busy") {
        if (block) {
          // This data has already been loaded.
          return this._blocks[rowBlock][colBlock][relRow][relCol];
        } else {
          // This data has not yet been loaded, load it.
          this._fetchBlock(rowBlock, colBlock);
        }
      }
    } else {
      // This data has not yet been loaded, load it.
      this._blocks[rowBlock] = Object();
      this._fetchBlock(rowBlock, colBlock);
    }

    return null;
  }

  get ixstr(): string {
    return this._ixstr;
  }
  set ixstr(ixstr: string) {
    this._ixstr = ixstr;
    this.refresh();
  }

  set meta(meta: IDatasetMeta) {
    this._meta = meta;

    // all reasoning about 0d vs 1d vs nd goes here
    if (this._meta.visshape.length < 1) {
      // for 0d (scalar), use (1, 1)
      this._hassubix = [false, false];
      [this._nrowheader, this._ncolheader] = [0, 0];
      [this._nrow, this._ncol] = [1, 1];
      [this._rowslice, this._colslice] = [slice(0, 1), slice(0, 1)];
    } else if (this._meta.vissize <= 0) {
      // for 0d (empty), use (0, 0)
      this._hassubix = [false, false];
      [this._nrowheader, this._ncolheader] = [0, 0];
      [this._nrow, this._ncol] = [0, 0];
      [this._rowslice, this._colslice] = [noneSlice(), noneSlice()];
    } else if (this._meta.visshape.length < 2) {
      // for 1d, use (1, size)
      this._hassubix = [false, true];
      [this._nrow, this._ncol] = [1, this._meta.vissize];
      [this._nrowheader, this._ncolheader] = [1, 0];
      [this._rowslice, this._colslice] = [slice(0, 1), this._meta.vislabels[0]];
    } else {
      // for 2d up, use standard shape
      this._hassubix = [true, true];
      [this._nrow, this._ncol] = this._meta.visshape;
      [this._nrowheader, this._ncolheader] = [1, 1];
      [this._rowslice, this._colslice] = this._meta.vislabels;
    }
  }

  /**
   * A promise that resolves when the file editor is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  async _refresh(meta: IDatasetMeta) {
    const oldRowCount = this.rowCount("body");
    const oldColCount = this.columnCount("body");

    // changing the meta will also change the result of the row/colCount methods
    this.meta = meta;

    this._blocks = Object();

    this.emitChanged({
      type: "rows-removed",
      region: "body",
      index: 0,
      span: oldRowCount
    });
    this.emitChanged({
      type: "columns-removed",
      region: "body",
      index: 0,
      span: oldColCount
    });

    this.emitChanged({
      type: "rows-inserted",
      region: "body",
      index: 0,
      span: this.rowCount("body")
    });
    this.emitChanged({
      type: "columns-inserted",
      region: "body",
      index: 0,
      span: this.columnCount("body")
    });

    this.emitChanged({
      type: "model-reset"
    });

    this._refreshed.emit(this.ixstr);
  }

  async refresh() {
    const params = {
      fpath: this._fpath,
      uri: this._uri,
      ixstr: this._ixstr
    };

    return hdfContentsRequest(params, this._serverSettings).then(
      contents => {
        return this._refresh((contents as HdfContents).content!);
      },
      err => {
        if (err instanceof HdfResponseError) {
          modalHdfError(err);
        } else {
          console.error(err);
        }
        return Promise.reject(err);
      }
    );
  }

  get refreshed() {
    return this._refreshed;
  }

  rowCount(region: DataModel.RowRegion): number {
    if (region === "body") {
      return this._nrow;
    }

    return this._nrowheader;
  }
  columnCount(region: DataModel.ColumnRegion): number {
    if (region === "body") {
      return this._ncol;
    }

    return this._ncolheader;
  }

  /**
   * fetch a data block. When data is received,
   * the grid will be updated by emitChanged.
   */
  private _fetchBlock = (rowBlock: number, colBlock: number) => {
    this._blocks[rowBlock][colBlock] = "busy";

    const row = rowBlock * this._blockSize;
    const rowStop: number = Math.min(
      row + this._blockSize,
      this.rowCount("body")
    );

    const column = colBlock * this._blockSize;
    const colStop: number = Math.min(
      column + this._blockSize,
      this.columnCount("body")
    );

    const subixstr = [
      this._hassubix[0] ? `${row}:${rowStop}` : "",
      this._hassubix[1] ? `${column}:${colStop}` : ""
    ]
      .filter(x => x)
      .join(", ");

    const params = {
      fpath: this._fpath,
      uri: this._uri,
      atleast_2d: true,
      ixstr: this._ixstr,
      subixstr
      // skip subixstr in the 0d case
      // ...(subixstr ? {subixstr: subixstr} : {}),
    };
    hdfDataRequest(params, this._serverSettings).then(
      data => {
        this._blocks[rowBlock][colBlock] = data;

        const msg = {
          type: "cells-changed",
          region: "body",
          row,
          column,
          rowSpan: rowStop - row,
          columnSpan: colStop - column
        };
        this.emitChanged(msg as DataModel.ChangedArgs);
      },
      err => {
        if (err instanceof HdfResponseError) {
          modalHdfError(err);
        } else {
          console.error(err);
        }
        return Promise.reject(err);
      }
    );
  };

  protected _serverSettings: ServerConnection.ISettings = ServerConnection.makeSettings();

  protected _fpath: string = "";
  protected _uri: string = "";
  protected _meta: IDatasetMeta;

  protected _hassubix = [false, false];
  protected _ixstr: string = "";
  protected _nrow = 0;
  protected _ncol = 0;
  protected _nrowheader = 0;
  protected _ncolheader = 0;
  protected _rowslice = noneSlice();
  protected _colslice = noneSlice();

  private _blocks: any = Object();
  private _blockSize: number = 100;

  private _ready = new PromiseDelegate<void>();
  private _refreshed = new Signal<this, string>(this);
}

/**
 * Subclass that constructs a dataset model from a document context
 */
class HdfDatasetModelContext extends HdfDatasetModelBase {
  constructor(context: DocumentRegistry.Context) {
    super();

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
   * Handle actions that should be taken when the context is ready.
   */
  private _onContextReady(): void {
    // get the fpath and the uri for this dataset
    const { fpath, uri } = parseHdfQuery(this._context.contentsModel.path);

    // unpack the content
    const content: IDatasetMeta = this._context.model.toJSON() as any;

    // // Wire signal connections.
    // contextModel.contentChanged.connect(this._onContentChanged, this);

    this.init({ fpath, uri, meta: content });
  }

  protected _context: DocumentRegistry.Context;
}

/**
 * Subclass that constructs a dataset model from simple parameters
 */
class HdfDatasetModelParams extends HdfDatasetModelBase {
  constructor(parameters: IContentsParameters) {
    super();

    hdfContentsRequest(parameters, this._serverSettings).then(hdfContents => {
      this._onMetaReady(parameters, hdfContents as HdfContents);
    });
  }

  /**
   * Handle actions that should be taken when the model is ready.
   */
  private _onMetaReady(
    parameters: IContentsParameters,
    contents: HdfContents
  ): void {
    const { fpath, uri } = parameters;
    this.init({ fpath, uri, meta: contents.content });
  }
}

export function createHdfGrid(
  dataModel: HdfDatasetModelBase
): { grid: DataGrid; toolbar: Toolbar<ToolbarButton> } {
  const grid = new DataGrid();
  grid.dataModel = dataModel;
  grid.keyHandler = new BasicKeyHandler();
  grid.mouseHandler = new BasicMouseHandler();
  grid.selectionModel = new BasicSelectionModel({ dataModel });

  const repainter = grid as any;
  const boundRepaint = repainter.repaintContent.bind(repainter);
  dataModel.refreshed.connect(boundRepaint);

  const toolbar = Private.createToolbar(grid);

  return { grid, toolbar };
}

export function createHdfGridFromPath(params: {
  fpath: string;
  uri: string;
}): { grid: DataGrid; reveal: Promise<void>; toolbar: Toolbar<ToolbarButton> } {
  const model = new HdfDatasetModelParams(params);
  const reveal = model.ready;

  const { grid, toolbar } = createHdfGrid(model);

  return { grid, reveal, toolbar };
}

/**
 * A mainarea widget for HDF content widgets.
 */
export class HdfDatasetMain extends MainAreaWidget<DataGrid> {
  constructor(params: { fpath: string; uri: string }) {
    const { grid: content, reveal, toolbar } = createHdfGridFromPath(params);

    super({ content, reveal, toolbar });
  }
}

/**
 * A document widget for HDF content widgets.
 */
export class HdfDatasetDoc extends DocumentWidget<DataGrid>
  implements IDocumentWidget<DataGrid> {
  constructor(context: DocumentRegistry.Context) {
    const model = new HdfDatasetModelContext(context);
    const { grid: content, toolbar } = createHdfGrid(model);
    const reveal = context.ready;

    super({ content, context, reveal, toolbar });
  }
}

/**
 * A widget factory for HDF5 data grids.
 */
export class HdfDatasetDocFactory extends ABCWidgetFactory<HdfDatasetDoc> {
  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(context: DocumentRegistry.Context): HdfDatasetDoc {
    return new HdfDatasetDoc(context);
  }
}

/**
 * A class that tracks hdf5 dataset document widgets.
 */
export interface IHdfDatasetDocTracker extends IWidgetTracker<HdfDatasetDoc> {}

export const IHdfDatasetDocTracker = new Token<IHdfDatasetDocTracker>(
  "jupyterlab-hdf:IHdfDatasetTracker"
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
    let node = document.createElement("div");
    node.className = HDF_CONTAINER_CLASS;
    let hdf = document.createElement("div");
    hdf.className = HDF_CLASS;
    node.appendChild(hdf);
    node.tabIndex = -1;
    return node;
  }

  /**
   * Create the toolbar for the HDF viewer.
   */
  export function createToolbar(grid: DataGrid): Toolbar<ToolbarButton> {
    const toolbar = new Toolbar();

    toolbar.addClass("jp-Toolbar");
    toolbar.addClass("jhdf-toolbar");

    toolbar.addItem("slice input", new IxInput(grid));

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
