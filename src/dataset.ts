// Copyright (c) Max Klein.
// Distributed under the terms of the Modified BSD License.

import { Token } from '@phosphor/coreutils';

import { DataGrid, DataModel } from '@phosphor/datagrid';

import { IWidgetTracker, Toolbar, ToolbarButton } from '@jupyterlab/apputils';

import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget,
  IDocumentWidget
} from '@jupyterlab/docregistry';

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

class H5ServDataModel extends DataModel {
  constructor(context: DocumentRegistry.Context) {
    super();
    this._url = context.path;
    fetch(this._url)
      .then(function(response) {
        return response.json();
      })
      .then(metadata => {
        [this._rowCount, this._columnCount] = metadata['shape']['dims'];
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
          span: this._columnCount
        });
      });
  }

  rowCount(region: DataModel.RowRegion): number {
    return region === 'body' ? this._rowCount : 1;
  }

  columnCount(region: DataModel.ColumnRegion): number {
    return region === 'body' ? this._columnCount : 1;
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
    const relColumn = column % this._blockSize;
    const rowBlock = (row - relRow) / this._blockSize;
    const columnBlock = (column - relColumn) / this._blockSize;
    if (this._blocks[rowBlock]) {
      if (this._blocks[rowBlock][columnBlock]) {
        // This data has already been loaded.
        return this._blocks[rowBlock][columnBlock][relRow][relColumn];
      }
    }
    // This data has not yet been loaded. Fetch the block that it is in.
    // When the data is received, this will be updated by emitChanged.
    this._fetchBlock(rowBlock, columnBlock);
    return null;
  }

  private _fetchBlock = (rowBlock: number, columnBlock: number) => {
    const rowStart: number = rowBlock * this._blockSize;
    const rowStop: number = Math.min(
      rowStart + this._blockSize,
      this._rowCount
    );
    const columnStart: number = columnBlock * this._blockSize;
    const columnStop: number = Math.min(
      columnStart + this._blockSize,
      this._columnCount
    );
    const query_params: string = `select=[${rowStart}:${rowStop},${columnStart}:${columnStop}]`;
    fetch(this._url + '/value?' + query_params)
      .then(function(response) {
        return response.json();
      })
      .then(data => {
        if (!this._blocks[rowBlock]) {
          this._blocks[rowBlock] = Object();
        }
        this._blocks[rowBlock][columnBlock] = data['value'];
        this.emitChanged({
          type: 'cells-changed',
          region: 'body',
          rowIndex: rowBlock * this._blockSize,
          columnIndex: columnBlock * this._blockSize,
          rowSpan: this._blockSize,
          columnSpan: this._blockSize
        });
      });
  };

  private _url: string = '';
  private _rowCount: number = 0;
  private _columnCount: number = 0;
  private _blockSize: number = 100;
  private _blocks: any = Object();
}

/**
 * A document widget for HDF content widgets.
 */
export class HdfDatasetWidget extends DocumentWidget<DataGrid>
  implements IDocumentWidget<DataGrid> {
  constructor(context: DocumentRegistry.Context) {
    const content = new DataGrid();
    content.model = new H5ServDataModel(context);
    const toolbar = Private.createToolbar(content);
    const reveal = context.ready;
    super({ content, context, reveal, toolbar });
  }
}

/**
 * A widget factory for HDF5 data grids.
 */
export class HdfDatasetFactory extends ABCWidgetFactory<
  IDocumentWidget<DataGrid>
> {
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
