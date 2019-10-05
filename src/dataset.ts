// Copyright (c) Max Klein.
// Distributed under the terms of the Modified BSD License.

import { PromiseDelegate, Token } from "@phosphor/coreutils";

import { DataGrid, DataModel } from "@phosphor/datagrid";

import { Signal } from "@phosphor/signaling";

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

import {
  HdfContents,
  hdfContentsRequest,
  hdfDataRequest,
  IContentsParameters,
  parseHdfQuery,
  IDatasetContent
} from "./hdf";
import { SliceInput } from "./toolbar";

import { ISlice, parseSlices } from "./slice";

/**
 * The CSS class for the data grid widget.
 */
export const HDF_CLASS = "jp-HdfDataGrid";

/**
 * The CSS class for our HDF5 container.
 */
export const HDF_CONTAINER_CLASS = "jp-HdfContainer";

/**
 * Base implementation of a dataset model
 */
export class HdfDatasetModelBase extends DataModel {
  constructor() {
    super();

    this._serverSettings = ServerConnection.makeSettings();
  }

  /**
   * Handle actions that should be taken when the context is ready.
   */
  init(content: { fpath: string; uri: string } & IDatasetContent): void {
    const { fpath, uri, shape } = content;

    this._fpath = fpath;
    this._uri = uri;

    this._rowCount = shape[0];
    this._colCount = shape[1];

    this.emitChanged({
      type: "rows-inserted",
      region: "body",
      index: 0,
      span: this._rowCount
    });
    this.emitChanged({
      type: "columns-inserted",
      region: "body",
      index: 0,
      span: this._colCount
    });

    // Resolve the ready promise.
    this._ready.resolve(undefined);
  }

  columnCount(region: DataModel.ColumnRegion): number {
    if (region === "body") {
      if (this.isColSlice()) {
        return this.colSlice.stop - this.colSlice.start;
      } else {
        return this._colCount;
      }
    }

    return 1;
  }

  rowCount(region: DataModel.RowRegion): number {
    if (region === "body") {
      if (this.isRowSlice()) {
        return this.rowSlice.stop - this.rowSlice.start;
      } else {
        return this._rowCount;
      }
    }

    return 1;
  }

  data(region: DataModel.CellRegion, row: number, col: number): any {
    // adjust row and col based on slice
    if (this.isRowSlice()) {
      row += this._rowSlice.start;
    }
    if (this.isColSlice()) {
      col += this._colSlice.start;
    }

    if (region === "row-header") {
      return `${row}`;
    }
    if (region === "column-header") {
      return `${col}`;
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

  /**
   * A promise that resolves when the file editor is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  refresh() {
    const oldRowCount = this.rowCount("body");
    const oldColCount = this.columnCount("body");

    // changing the row/col slices will also change the result
    // of the row/colCount methods
    const slices = parseSlices(this._slice);
    this._rowSlice = slices[0];
    this._colSlice = slices[1];

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

    this._refreshed.emit();
  }

  isRowSlice(): boolean {
    return !(isNaN(this._rowSlice.start) && isNaN(this._rowSlice.start));
  }

  isColSlice(): boolean {
    return !(isNaN(this._colSlice.start) && isNaN(this._colSlice.start));
  }

  get rowSlice() {
    return {
      start: this._rowSlice.start || 0,
      stop: this._rowSlice.stop || this._rowCount
    };
  }
  get colSlice() {
    return {
      start: this._colSlice.start || 0,
      stop: this._colSlice.stop || this._colCount
    };
  }

  get slice(): string {
    return this._slice;
  }
  set slice(s: string) {
    this._slice = s;
    this.refresh();
  }

  get refreshed() {
    return this._refreshed;
  }

  /**
   * fetch a data block. When data is received,
   * the grid will be updated by emitChanged.
   */
  private _fetchBlock = (rowBlock: number, colBlock: number) => {
    this._blocks[rowBlock][colBlock] = "busy";

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
      select: `[${rowStart}:${rowStop}, ${colStart}:${colStop}]`
    };
    hdfDataRequest(params, this._serverSettings).then(data => {
      this._blocks[rowBlock][colBlock] = data;
      this.emitChanged({
        type: "cells-changed",
        region: "body",
        rowIndex:
          (rowBlock -
            (this.isRowSlice() ? this._rowSlice.start / this._blockSize : 0)) *
          this._blockSize, //rowBlock * this._blockSize,
        columnIndex:
          (colBlock -
            (this.isColSlice() ? this._colSlice.start / this._blockSize : 0)) *
          this._blockSize, //colBlock * this._blockSize,
        rowSpan: this._blockSize,
        columnSpan: this._blockSize
      });
    });
  };

  protected _serverSettings: ServerConnection.ISettings;

  private _fpath: string = "";
  private _uri: string = "";

  private _slice: string = "";
  private _colSlice: ISlice = { start: null, stop: null };
  private _rowSlice: ISlice = { start: null, stop: null };

  private _blocks: any = Object();
  private _blockSize: number = 100;
  private _colCount: number = 0;
  private _rowCount: number = 0;

  private _ready = new PromiseDelegate<void>();
  private _refreshed = new Signal<this, void>(this);
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
    const content: IDatasetContent = this._context.model.toJSON() as any;

    // // Wire signal connections.
    // contextModel.contentChanged.connect(this._onContentChanged, this);

    this.init({ ...content, fpath, uri });
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
    this.init({ ...contents.content, fpath, uri });
  }
}

export function createHdfGrid(params: {
  fpath: string;
  uri: string;
}): DataGrid {
  const model = new HdfDatasetModelParams(params);

  const grid = new DataGrid();
  grid.model = model;

  // const boundRepaint = grid.repaint.bind(grid);
  // model.refreshed.connect(boundRepaint);

  // model.refreshed.connect(grid.repaint, grid);

  // model.refreshed.connect(() => grid.repaint());

  return grid;
}

/**
 * A mainarea widget for HDF content widgets.
 */
export class HdfDatasetMain extends MainAreaWidget<DataGrid> {
  constructor(params: { fpath: string; uri: string }) {
    const content = createHdfGrid(params);

    const toolbar = Private.createToolbar(content);
    const reveal = (content.model as HdfDatasetModelParams).ready;
    super({ content, reveal, toolbar });
  }
}

/**
 * A document widget for HDF content widgets.
 */
export class HdfDatasetDoc extends DocumentWidget<DataGrid>
  implements IDocumentWidget<DataGrid> {
  constructor(context: DocumentRegistry.Context) {
    const content = new DataGrid();
    const model = new HdfDatasetModelContext(context);
    content.model = model;

    // model.refreshed.connect(() => content.repaint());

    const toolbar = Private.createToolbar(content);
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
    toolbar.addClass("jp-Hdf-toolbar");

    toolbar.addItem("slice input", new SliceInput(grid));

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
