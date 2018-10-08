// Copyright (c) Max Klein.
// Distributed under the terms of the Modified BSD License.

import { PromiseDelegate } from '@phosphor/coreutils';

import {DataGrid, DataModel} from '@phosphor/datagrid';

import { ElementExt } from '@phosphor/domutils';

import { Message } from '@phosphor/messaging';

import { Widget } from '@phosphor/widgets';

import { Toolbar, ToolbarButton } from '@jupyterlab/apputils';

import { PathExt } from '@jupyterlab/coreutils';

import { ISignal, Signal } from '@phosphor/signaling';

import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget,
  IDocumentWidget
} from '@jupyterlab/docregistry';

/**
 * The MIME type for HDF5.
 */
export const MIME_TYPE = 'application/x-hdf5';

/**
 * The CSS class for our HDF container.
 */
export const HDF_CONTAINER_CLASS = 'jp-HDFJSContainer';

class H5ServDataModel extends DataModel {
  constructor(url: string) {
    super();
    this._url = url;
    fetch(url).then(function(response) {
      return response.json();
    }).then((metadata) => {
      [this._rowCount, this._columnCount] = metadata['shape']['dims'];
      this.emitChanged({ type: 'rows-inserted', region: 'body',
        index: 0, span: this._rowCount });
      this.emitChanged({ type: 'columns-inserted', region: 'body',
        index: 0, span: this._columnCount });
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
        return this._blocks[rowBlock][columnBlock][relRow][relColumn]
      }
    }
    // This data has not yet been loaded. Fetch the block that it is in.
    // When the data is received, this will be updated by emitChanged.
    this._fetchBlock(rowBlock, columnBlock);
    return null;
  }

  private _fetchBlock = (rowBlock: number, columnBlock: number) => {
    const rowStart : number = rowBlock * this._blockSize;
    const rowStop : number = Math.min(rowStart + this._blockSize,
      this._rowCount);
    const columnStart : number = columnBlock * this._blockSize;
    const columnStop: number = Math.min(columnStart + this._blockSize,
      this._columnCount);
    const query_params : string = `select=[${rowStart}:${rowStop},${columnStart}:${columnStop}]`
    fetch(this._url + '/value?' + query_params).then(function(response) {
      return response.json();
    }).then((data) => {
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
 * A class for rendering a HDF document.
 */
export class HDFJSViewer extends Widget {
  constructor(context: DocumentRegistry.Context) {
    super({ node: Private.createNode() });
    this.viewer = new HDFJS.HDFViewer({ container: this.node });

    this.context = context;
    this._onTitleChanged();
    context.pathChanged.connect(
      this._onTitleChanged,
      this
    );

    context.ready.then(() => {
      if (this.isDisposed) {
        return;
      }
      this._render().then(() => {
        this._ready.resolve(void 0);
      });
      context.model.contentChanged.connect(
        this.update,
        this
      );
      context.fileChanged.connect(
        this.update,
        this
      );
    });
  }

  /**
   * The hdfjs widget's context.
   */
  readonly context: DocumentRegistry.Context;

  /**
   * The underlying HDFJS viewer/
   */
  readonly viewer: any;

  /**
   * A promise that resolves when the hdf viewer is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * Get the scroll position.
   */
  get position(): HDFJSViewer.IPosition {
    return {
      page: this.viewer.currentPageNumber,
      x: 0,
      y: 0
    };
  }

  /**
   * Set the scroll position.
   */
  set position(pos: HDFJSViewer.IPosition) {
    // Clamp the page number.
    const pageNumber = Math.max(
      Math.min(pos.page, this.viewer.pagesCount + 1),
      1
    );
    const page = this.viewer.getPageView(pageNumber - 1);

    // Flip the y position for HDFJS, including a margin so
    // that it is not at the exact top of the screen.
    const yMax = page.viewport.viewBox[3];
    const yPos = Math.max(Math.min(yMax - (pos.y - MARGIN), yMax), 0);

    // Scroll page into view using a very undocumented
    // set of options. This particular set scrolls it to
    // an x,y position on a given page, with a given scale value.
    this.viewer.scrollPageIntoView({
      pageNumber,
      destArray: [
        pageNumber,
        { name: 'XYZ' },
        pos.x,
        yPos,
        this.viewer.currentScaleValue
      ]
    });
  }

  /**
   * Dispose of the resources held by the hdf widget.
   */
  dispose() {
    try {
      URL.revokeObjectURL(this._objectUrl);
    } catch (error) {
      /* no-op */
    }
    super.dispose();
  }

  get positionRequested(): ISignal<this, HDFJSViewer.IPosition> {
    return this._positionRequested;
  }

  /**
   * Handle a change to the title.
   */
  private _onTitleChanged(): void {
    this.title.label = PathExt.basename(this.context.localPath);
  }

  /**
   * Render HDF into this widget's node.
   */
  private _render(): Promise<void> {
    return new Promise<void>(resolve => {
      let data = this.context.model.toString();
      // If there is no data, do nothing.
      if (!data) {
        resolve(void 0);
      }
      const blob = Private.b64toBlob(data, MIME_TYPE);

      let oldDocument = this._hdfDocument;
      let oldUrl = this._objectUrl;
      this._objectUrl = URL.createObjectURL(blob);

      let scale: number | string = 'page-width';
      let scrollTop = 0;

      // Try to keep the scale and scroll position.
      if (this._hasRendered && this.isVisible) {
        scale = this.viewer.currentScale || scale;
        scrollTop = this.node.scrollTop;
      }

      const cleanup = () => {
        // Release reference to any previous document.
        if (oldDocument) {
          oldDocument.destroy();
        }
        // Release reference to any previous object url.
        if (oldUrl) {
          try {
            URL.revokeObjectURL(oldUrl);
          } catch (error) {
            /* no-op */
          }
        }
      };

      HDFJS.getDocument(this._objectUrl)
        .then((hdfDocument: any) => {
          this._hdfDocument = hdfDocument;
          this.viewer.setDocument(hdfDocument);
          this.viewer.firstPagePromise.then(() => {
            if (this.isVisible) {
              this.viewer.currentScaleValue = scale;
            }
            this._hasRendered = true;
            resolve(void 0);
          });
          this.viewer.pagesPromise.then(() => {
            if (this.isVisible) {
              this.node.scrollTop = scrollTop;
            }
            cleanup();
          });
        })
        .catch(cleanup);
    });
  }

  /**
   * Handle DOM events for the widget.
   */
  handleEvent(event: Event): void {
    if (!this.viewer) {
      return;
    }
    switch (event.type) {
      case 'click':
        this._handleClick(event as MouseEvent);
        break;
      default:
        break;
    }
  }

  private _handleClick(evt: MouseEvent): void {
    // If it is a normal click, return without doing anything.
    const shiftAccel = (evt: MouseEvent): boolean => {
      return evt.shiftKey
        ? (IS_MAC && evt.metaKey) || (!IS_MAC && evt.ctrlKey)
        : false;
    };
    if (!shiftAccel(evt)) {
      return;
    }

    // Get the page position of the click.
    const pos = this._clientToHDFPosition(evt.clientX, evt.clientY);

    // If the click was not on a page, do nothing.
    if (!pos) {
      return;
    }
    // Emit the `positionRequested` signal.
    this._positionRequested.emit(pos);
  }

  private _clientToHDFPosition(
    x: number,
    y: number
  ): HDFJSViewer.IPosition | undefined {
    let page: any;
    let pageNumber = 0;
    for (; pageNumber < this.viewer.pagesCount; pageNumber++) {
      const pageView = this.viewer.getPageView(pageNumber);
      // If the page is not rendered (as happens when it is
      // scrolled out of view), then the textLayer div doesn't
      // exist, and we can safely skip it.
      if (!pageView.textLayer) {
        continue;
      }
      const pageDiv = pageView.textLayer.textLayerDiv;
      if (ElementExt.hitTest(pageDiv, x, y)) {
        page = pageView;
        break;
      }
    }
    if (!page) {
      return;
    }
    const pageDiv = page.textLayer.textLayerDiv;
    const boundingRect = pageDiv.getBoundingClientRect();
    const localX = x - boundingRect.left;
    const localY = y - boundingRect.top;
    const viewport = page.viewport.clone({ dontFlip: true });
    const [hdfX, hdfY] = viewport.convertToHdfPoint(localX, localY);
    return {
      page: pageNumber + 1,
      x: hdfX,
      y: hdfY
    } as HDFJSViewer.IPosition;
  }

  /**
   * Handle `after-attach` messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.node.addEventListener('click', this);
  }

  /**
   * Handle `before-detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    let node = this.node;
    node.removeEventListener('click', this);
  }

  /**
   * Fit the HDF to the widget width.
   */
  fit(): void {
    if (this.isVisible) {
      this.viewer.currentScaleValue = 'page-width';
    }
  }

  /**
   * Handle `update-request` messages for the widget.
   */
  protected onUpdateRequest(msg: Message): void {
    if (this.isDisposed || !this.context.isReady) {
      return;
    }
    this._render();
  }

  private _ready = new PromiseDelegate<void>();
  private _objectUrl = '';
  private _hdfDocument: any;
  private _positionRequested = new Signal<this, HDFJSViewer.IPosition>(this);
  private _hasRendered = false;
}

/**
 * A document widget for HDFJS content widgets.
 */
export class HDFJSDocumentWidget extends DocumentWidget<HDFJSViewer>
  implements IDocumentWidget<HDFJSViewer> {
  constructor(context: DocumentRegistry.Context) {
    const content = new HDFJSViewer(context);
    const toolbar = Private.createToolbar(content.viewer);
    const reveal = content.ready;
    super({ content, context, reveal, toolbar });
  }
}

/**
 * A widget factory for images.
 */
export class HDFJSViewerFactory extends ABCWidgetFactory<
  IDocumentWidget<HDFJSViewer>,
  DocumentRegistry.IModel
  > {
  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(
    context: DocumentRegistry.IContext<DocumentRegistry.IModel>
  ): IDocumentWidget<HDFJSViewer> {
    return new HDFJSDocumentWidget(context);
  }
}

/**
 * A namespace for HDFJSViewer statics.
 */
export namespace HDFJSViewer {
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
    toolbar.addClass('jp-HDFJS-toolbar');

    toolbar.addItem(
      'previous',
      new ToolbarButton({
        iconClassName: 'jp-PreviousIcon jp-Icon jp-Icon-16',
        onClick: () => {
          hdfViewer.currentPageNumber = Math.max(
            hdfViewer.currentPageNumber - 1,
            1
          );
        },
        tooltip: 'Previous Page'
      })
    );
    toolbar.addItem(
      'next',
      new ToolbarButton({
        iconClassName: 'jp-NextIcon jp-Icon jp-Icon-16',
        onClick: () => {
          hdfViewer.currentPageNumber = Math.min(
            hdfViewer.currentPageNumber + 1,
            hdfViewer.pagesCount
          );
        },
        tooltip: 'Next Page'
      })
    );

    toolbar.addItem('spacer', Toolbar.createSpacerItem());

    toolbar.addItem(
      'zoomOut',
      new ToolbarButton({
        iconClassName: 'jp-ZoomOutIcon jp-Icon jp-Icon-16',
        onClick: () => {
          let newScale = hdfViewer.currentScale;

          newScale = (newScale / SCALE_DELTA).toFixed(2);
          newScale = Math.floor(newScale * 10) / 10;
          newScale = Math.max(MIN_SCALE, newScale);

          hdfViewer.currentScale = newScale;
        },
        tooltip: 'Zoom Out'
      })
    );
    toolbar.addItem(
      'zoomIn',
      new ToolbarButton({
        iconClassName: 'jp-ZoomInIcon jp-Icon jp-Icon-16',
        onClick: () => {
          let newScale = hdfViewer.currentScale;

          newScale = (newScale * SCALE_DELTA).toFixed(2);
          newScale = Math.ceil(newScale * 10) / 10;
          newScale = Math.min(MAX_SCALE, newScale);

          hdfViewer.currentScale = newScale;
        },
        tooltip: 'Zoom In'
      })
    );

    toolbar.addItem(
      'fit',
      new ToolbarButton({
        iconClassName: 'jp-FitIcon jp-Icon jp-Icon-16',
        onClick: () => {
          hdfViewer.currentScaleValue = 'page-width';
        },
        tooltip: 'Fit to Page Width'
      })
    );

    return toolbar;
  }

  /**
   * Convert a base64 encoded string to a Blob object.
   * Modified from a snippet found here:
   * https://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript
   *
   * @param b64Data - The base64 encoded data.
   *
   * @param contentType - The mime type of the data.
   *
   * @param sliceSize - The size to chunk the data into for processing.
   *
   * @returns a Blob for the data.
   */
  export function b64toBlob(
    b64Data: string,
    contentType: string = '',
    sliceSize: number = 512
  ): Blob {
    const byteCharacters = atob(b64Data);
    let byteArrays: Uint8Array[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      let slice = byteCharacters.slice(offset, offset + sliceSize);

      let byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      let byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    let blob = new Blob(byteArrays, { type: contentType });
    return blob;
  }
}
