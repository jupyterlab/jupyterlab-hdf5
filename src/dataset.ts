// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { PromiseDelegate, Token } from '@lumino/coreutils';

import {
  BasicKeyHandler,
  BasicMouseHandler,
  BasicSelectionModel,
  DataGrid,
  DataModel,
} from '@lumino/datagrid';

import { Signal } from '@lumino/signaling';

import {
  IWidgetTracker,
  MainAreaWidget,
  Toolbar,
  ToolbarButton,
} from '@jupyterlab/apputils';

import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget,
  IDocumentWidget,
} from '@jupyterlab/docregistry';

import { ServerConnection } from '@jupyterlab/services';

import {
  HdfResponseError,
  modalHdfError,
  modalResponseError,
  modalValidationFail,
} from './exception';

import {
  datasetMetaEmpty,
  hdfDataRequest,
  hdfMetaRequest,
  IDataParameters,
  IMetaParameters,
  IDatasetMeta,
  parseHdfQuery,
} from './hdf';

import { noneSlice, slice } from './slice';

import { IxInput } from './toolbar';
import { convertValuesToString, isComplexArray } from './complex';

/**
 * The CSS class for the data grid widget.
 */
export const HDF_CLASS = 'jhdf-dataGrid';

/**
 * The CSS class for our HDF5 container.
 */
export const HDF_CONTAINER_CLASS = 'jhdf-container';

/**
 * Base implementation of the hdf dataset model.
 */
export abstract class HdfDatasetModel extends DataModel {
  /**
   * Handle actions that should be taken when the context is ready.
   */
  init({
    fpath,
    uri,
    meta,
  }: {
    fpath: string;
    uri: string;
    meta: IDatasetMeta;
  }): void {
    this._fpath = fpath;
    this._uri = uri;
    this._meta = meta;

    // create a default index string
    if (this._meta.ndim < 1) {
      this._ixstr = '';
    } else if (this._meta.ndim < 2) {
      this._ixstr = ':';
    } else {
      this._ixstr = [...Array(this._meta.ndim - 2).fill('0'), ':', ':'].join(
        ', '
      );
    }

    // derive metadata for the default ixstr (eg ':, :, ...') from the metadata for no ixstr (eg '...')
    const metaIx: IDatasetMeta = {
      ...meta,
      labels: meta.labels.slice(-2),
      ndim: Math.max(meta.ndim, 2),
      shape: meta.shape.slice(-2),
      size: meta.shape.length
        ? meta.shape.slice(-2).reduce((x, y) => x * y)
        : meta.size,
    };

    // Refresh wrt the newly set ix and then resolve the ready promise.
    this._refresh(metaIx);
    this._ready.resolve(undefined);
  }

  data(region: DataModel.CellRegion, row: number, col: number): any {
    if (region === 'row-header') {
      return `${this._labels[0].start + row * this._labels[0].step}`;
    }
    if (region === 'column-header') {
      return `${this._labels[1].start + col * this._labels[1].step}`;
    }
    if (region === 'corner-header') {
      return null;
    }

    const relRow = row % this._blockSize;
    const relCol = col % this._blockSize;
    const rowBlock = (row - relRow) / this._blockSize;
    const colBlock = (col - relCol) / this._blockSize;
    if (this._blocks[rowBlock]) {
      const block = this._blocks[rowBlock][colBlock];
      if (block !== 'busy') {
        if (block) {
          // This data has already been loaded.
          return this._blocks[rowBlock][colBlock][relRow][relCol];
        } else {
          // This data has not yet been loaded, load it.
          this._blocks[rowBlock][colBlock] = 'busy';
          this._fetchBlock(rowBlock, colBlock);
        }
      }
    } else {
      // This data has not yet been loaded, load it.
      this._blocks[rowBlock] = Object();
      this._blocks[rowBlock][colBlock] = 'busy';
      this._fetchBlock(rowBlock, colBlock);
    }

    return null;
  }

  get ixstr(): string {
    return this._ixstr;
  }
  set ixstr(ixstr: string) {
    this.refresh(ixstr);
  }

  get meta(): IDatasetMeta {
    return this._meta;
  }
  get metaIx(): IDatasetMeta {
    return this._metaIx;
  }

  /**
   * A promise that resolves when the file editor is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  async refresh(ixstr: string): Promise<void> {
    const meta = await this.getMeta({
      fpath: this._fpath,
      uri: this._uri,
      ixstr,
    });
    if (!this.validateMeta(ixstr, meta)) {
      this._refreshed.emit(this._ixstr);
      return;
    }

    this._ixstr = ixstr;
    this._refresh(meta);
  }

  get refreshed(): Signal<this, string> {
    return this._refreshed;
  }

  rowCount(region: DataModel.RowRegion): number {
    if (region === 'body') {
      return this._n[0];
    }

    return this._nheader[0];
  }
  columnCount(region: DataModel.ColumnRegion): number {
    if (region === 'body') {
      return this._n[1];
    }

    return this._nheader[1];
  }

  protected async getData(
    params: IDataParameters
  ): Promise<number[][] | string[][]> {
    try {
      const data = await hdfDataRequest(params, this._serverSettings);
      const { dtype } = this.meta;
      if (isComplexArray(data, dtype)) {
        return convertValuesToString(data) as string[][];
      }
      return data;
    } catch (err) {
      // on any error, reduce displayed shape to [] in order to prevent unending failed data requests
      this._refresh(datasetMetaEmpty());

      if (err instanceof HdfResponseError) {
        modalHdfError(err);
      } else if (err instanceof ServerConnection.ResponseError) {
        modalResponseError(err);
      } else {
        throw err;
      }
    }
  }

  protected async getMeta(params: IMetaParameters): Promise<IDatasetMeta> {
    try {
      return (await hdfMetaRequest(
        params,
        this._serverSettings
      )) as IDatasetMeta;
    } catch (err) {
      // on any error, reduce displayed shape to [] in order to prevent unending failed data requests
      this._refresh(datasetMetaEmpty());

      if (err instanceof HdfResponseError) {
        modalHdfError(err);
      } else if (err instanceof ServerConnection.ResponseError) {
        modalResponseError(err);
      } else {
        throw err;
      }
    }
  }

  protected validateMeta(ixstr: string, meta: IDatasetMeta): boolean {
    if (meta.ndim > 2) {
      modalValidationFail(
        `index has too many dimensions. Please specify an index with 2 or fewer slices. ixstr: ${ixstr}, ndim: ${meta.ndim}`
      );
      return false;
    }

    return true;
  }

  /**
   * fetch a data block. When data is received,
   * the grid will be updated by emitChanged.
   */
  private _fetchBlock = async (rowBlock: number, colBlock: number) => {
    const row = rowBlock * this._blockSize;
    const rowStop: number = Math.min(
      row + this._blockSize,
      this.rowCount('body')
    );

    const column = colBlock * this._blockSize;
    const colStop: number = Math.min(
      column + this._blockSize,
      this.columnCount('body')
    );

    const subixstr = [
      this._hassubix[0] ? `${row}:${rowStop}` : '',
      this._hassubix[1] ? `${column}:${colStop}` : '',
    ]
      .filter(x => x)
      .join(', ');

    const params = {
      fpath: this._fpath,
      uri: this._uri,
      ixstr: this._ixstr,
      min_ndim: 2,
      subixstr,
    };

    const data = await this.getData(params);
    this._blocks[rowBlock][colBlock] = data;

    const msg = {
      type: 'cells-changed',
      region: 'body',
      row,
      column,
      rowSpan: rowStop - row,
      columnSpan: colStop - column,
    };
    this.emitChanged(msg as DataModel.ChangedArgs);
  };

  private _refresh(meta: IDatasetMeta) {
    const oldRowCount = this.rowCount('body');
    const oldColCount = this.columnCount('body');

    // changing the index meta will also change the result of the row/colCount methods
    this._setMetaIx(meta);

    this._blocks = Object();

    this.emitChanged({
      type: 'rows-removed',
      region: 'body',
      index: 0,
      span: oldRowCount,
    });
    this.emitChanged({
      type: 'columns-removed',
      region: 'body',
      index: 0,
      span: oldColCount,
    });

    this.emitChanged({
      type: 'rows-inserted',
      region: 'body',
      index: 0,
      span: this.rowCount('body'),
    });
    this.emitChanged({
      type: 'columns-inserted',
      region: 'body',
      index: 0,
      span: this.columnCount('body'),
    });

    this.emitChanged({
      type: 'model-reset',
    });

    this._refreshed.emit(this.ixstr);
  }

  private _setMetaIx(meta: IDatasetMeta) {
    this._metaIx = meta;

    // all reasoning about 0d vs 1d vs nd goes here
    if (this._metaIx.size <= 0) {
      // for 0d (empty), use (0, 0)
      this._hassubix = [false, false];
      this._n = [0, 0];
      this._nheader = [0, 0];
      this._labels = [noneSlice(), noneSlice()];
    } else if (this._metaIx.shape.length < 1) {
      // for 0d (scalar), use (1, 1)
      this._hassubix = [false, false];
      this._n = [1, 1];
      this._nheader = [0, 0];
      this._labels = [slice(0, 1), slice(0, 1)];
    } else if (this._metaIx.shape.length < 2) {
      // for 1d, use (1, size)
      this._hassubix = [false, true];
      this._n = [1, this._metaIx.size];
      this._nheader = [1, 0];
      this._labels = [slice(0, 1), this._metaIx.labels[0]];
    } else {
      // for 2d up, use standard shape
      this._hassubix = [true, true];
      this._n = this._metaIx.shape;
      this._nheader = [1, 1];
      this._labels = this._metaIx.labels;
    }
  }

  protected _fpath: string = '';
  protected _uri: string = '';

  protected _serverSettings: ServerConnection.ISettings = ServerConnection.makeSettings();

  protected _hassubix = [false, false];
  protected _n = [0, 0];
  protected _nheader = [0, 0];
  protected _labels = [noneSlice(), noneSlice()];

  private _meta: IDatasetMeta;
  private _metaIx: IDatasetMeta;
  private _ixstr: string = '';

  private _blocks: any = Object();
  private _blockSize: number = 100;

  private _ready = new PromiseDelegate<void>();
  private _refreshed = new Signal<this, string>(this);
}

/**
 * Subclass that constructs a dataset model from a document context
 */
class HdfDatasetModelFromContext extends HdfDatasetModel {
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
export class HdfDatasetModelFromPath extends HdfDatasetModel {
  constructor(params: IMetaParameters) {
    super();

    this.getMeta(params).then(meta => {
      this._onMetaReady(params, meta);
    });
  }

  /**
   * Handle actions that should be taken when the model is ready.
   */
  private _onMetaReady(
    { fpath, uri }: IMetaParameters,
    meta: IDatasetMeta
  ): void {
    this.init({ fpath, uri, meta });
  }
}

function createHdfGrid(
  dataModel: HdfDatasetModel
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

export function createHdfGridFromContext(
  context: DocumentRegistry.Context
): { grid: DataGrid; reveal: Promise<void>; toolbar: Toolbar<ToolbarButton> } {
  const model = new HdfDatasetModelFromContext(context);
  const reveal = context.ready;

  const { grid, toolbar } = createHdfGrid(model);

  return { grid, reveal, toolbar };
}

export function createHdfGridFromPath(params: {
  fpath: string;
  uri: string;
}): { grid: DataGrid; reveal: Promise<void>; toolbar: Toolbar<ToolbarButton> } {
  const model = new HdfDatasetModelFromPath(params);
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
export class HdfDatasetDoc
  extends DocumentWidget<DataGrid>
  implements IDocumentWidget<DataGrid> {
  constructor(context: DocumentRegistry.Context) {
    const { grid: content, reveal, toolbar } = createHdfGridFromContext(
      context
    );

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
  export function createToolbar(grid: DataGrid): Toolbar<ToolbarButton> {
    const toolbar = new Toolbar();

    toolbar.addClass('jp-Toolbar');
    toolbar.addClass('jhdf-toolbar');

    toolbar.addItem('slice input', new IxInput(grid));

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
