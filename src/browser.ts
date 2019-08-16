// Copyright (c) Max Klein.
// Distributed under the terms of the Modified BSD License.

// import { ToolbarButton } from '@jupyterlab/apputils';

import { FileBrowser } from '@jupyterlab/filebrowser';

import { Message } from '@phosphor/messaging';

import { ISignal, Signal } from '@phosphor/signaling';

import { PanelLayout, Widget } from '@phosphor/widgets';

import { HdfDrive } from './contents';
import { localAbsPath, parseHdfQuery } from './hdf';

const FACTORY = 'HDF Dataset';
const DATA_MIME = 'application/x-hdf5.dataset';

/**
 * Widget for hosting the Hdf filebrowser.
 */
export class HdfFileBrowser extends Widget {
  constructor(browser: FileBrowser, drive: HdfDrive) {
    super();
    this.addClass('jp-HdfBrowser');
    this.layout = new PanelLayout();
    (this.layout as PanelLayout).addWidget(browser);
    this._browser = browser;
    this._drive = drive;

    this._monkeyPatch();

    // Create an editable name for the Hdf file path.
    this.fpath = new hdfFpathInput(browser);
    this.fpath.node.title = 'Click to edit file path';
    this._browser.toolbar.addItem('fpath', this.fpath);
    this.fpath.pathChanged.connect(this._onFpathChanged, this);

    // // Add our own refresh button, since the other one is hidden
    // // via CSS.
    // let refresher = new ToolbarButton({
    //   iconClassName: 'jp-RefreshIcon jp-Icon jp-Icon-16',
    //   onClick: () => {
    //     this._browser.model.refresh();
    //   },
    //   tooltip: 'Refresh File List'
    // });
    // refresher.addClass('jp-Hdf-toolbar-item');
    // this._browser.toolbar.addItem('gh-refresher', refresher);
  }

  /**
   * An editable widget hosting the current file path.
   */
  readonly fpath: hdfFpathInput;

  private _monkeyPatch() {
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

      const item = this._browser.modelForClick(event);
      console.log(item);
      if (!item) {
        return;
      }
      if (item.type === 'directory') {
        this._browser.model
          .cd(localAbsPath(item.path))
          .catch(error => console.error(error));
      } else {
        const factory = item.mimetype === DATA_MIME ? FACTORY : 'default';
        this._browser.model.manager.openOrReveal(item.path, factory);
      }
    };

    this._browser.node.addEventListener('dblclick', handleDblClick, true);
  }

  /**
   * React to a change in fpath.
   */
  private _onFpathChanged() {
    if (this._changeGuard) {
      return;
    }
    this._changeGuard = true;
    this._browser.model
      .cd(`/${this.fpath.path}`)
      .then(() => {
        this._changeGuard = false;
        this._updateErrorPanel();
        // Once we have the new listing, maybe give the file listing
        // focus. Once the input element is removed, the active element
        // appears to revert to document.body. If the user has subsequently
        // focused another element, don't focus the browser listing.
        if (document.activeElement === document.body) {
          const listing = (this._browser.layout as PanelLayout).widgets[2];
          listing.node.focus();
        }
      })
      .catch((err: Error) => {
        const msg =
          `Failed to open HDF5 file at ${this.fpath.path}` + err.message;
        console.error(msg);
        this._updateErrorPanel(err);
      });
  }

  // /**
  //  * React to the path changing for the browser.
  //  */
  // private _onPathChanged(): void {
  //   const localPath = this._browser.model.manager.services.contents.localPath(
  //     this._browser.model.path
  //   );
  //   const resource = parsePath(localPath);
  //
  //   // If we are not already changing the user name, set it.
  //   if (!this._changeGuard) {
  //     this._changeGuard = true;
  //     this.fpath.name = resource.user;
  //     this._changeGuard = false;
  //     this._updateErrorPanel();
  //   }
  //
  //   // If we got this far, we are in a subdirectory of a valid
  //   // repository, and should not change the binderActive status.
  //   return;
  // }

  /**
   * React to a change in the validity of the drive.
   */
  private _updateErrorPanel(err?: Error): void {
    const localPath = this._browser.model.manager.services.contents.localPath(
      this._browser.model.path
    );
    const params = parseHdfQuery(localPath);

    // If we currently have an error panel, remove it.
    if (this._errorPanel) {
      const listing = (this._browser.layout as PanelLayout).widgets[2];
      listing.node.removeChild(this._errorPanel.node);
      this._errorPanel.dispose();
      this._errorPanel = null;
    }

    if (err) {
      const msg =
        `Failed to open HDF5 file at ${this.fpath.path}` + err.message;
      this._initErrorPanel(msg);
      return;
    }

    if (!this._drive.validFile) {
      // If we have an invalid file path, make an error msg.
      const msg = `No file found at path: ${params.fpath}`;
      this._initErrorPanel(msg);
      return;
    }
  }

  private _initErrorPanel(msg: string) {
    this._errorPanel = new HdfErrorPanel(msg);
    const listing = (this._browser.layout as PanelLayout).widgets[2];
    listing.node.appendChild(this._errorPanel.node);
  }

  private _browser: FileBrowser;
  private _drive: HdfDrive;
  private _errorPanel: HdfErrorPanel | null;
  private _changeGuard = false;
}

/**
 * A widget that hosts an editable field,
 * used to host the currently active Hdf
 * file path.
 */
export class hdfFpathInput extends Widget {
  constructor(browser: FileBrowser) {
    super();
    this._browser = browser;

    this.addClass('jp-HdfUserInput');
    const layout = (this.layout = new PanelLayout());
    const wrapper = new Widget();
    wrapper.addClass('jp-HdfUserInput-wrapper');
    this._input = document.createElement('input');
    this._input.placeholder = 'HDF5 Path';
    this._input.className = 'jp-HdfUserInput-input';
    wrapper.node.appendChild(this._input);
    layout.addWidget(wrapper);
  }

  /**
   * The current name of the field.
   */
  get path(): string {
    return this._path;
  }
  set path(value: string) {
    if (value === this._browser.model.path) {
      return;
    }
    const old = this._path;
    this._path = value;
    this._input.value = value;
    this._pathChanged.emit({
      oldValue: old,
      newValue: value
    });
  }

  /**
   * A signal for when the name changes.
   */
  get pathChanged(): ISignal<this, { newValue: string; oldValue: string }> {
    return this._pathChanged;
  }

  /**
   * Handle the DOM events for the widget.
   *
   * @param event - The DOM event sent to the widget.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the main area widget's node. It should
   * not be called directly by user code.
   */
  handleEvent(event: KeyboardEvent): void {
    switch (event.type) {
      case 'keydown':
        switch (event.keyCode) {
          case 13: // Enter
            event.stopPropagation();
            event.preventDefault();
            this.path = this._input.value;
            this._input.blur();
            break;
          default:
            break;
        }
        break;
      case 'blur':
        event.stopPropagation();
        event.preventDefault();
        this.path = this._input.value;
        break;
      case 'focus':
        event.stopPropagation();
        event.preventDefault();
        this._input.select();
        break;
      default:
        break;
    }
  }

  /**
   * Handle `after-attach` messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    this._input.addEventListener('keydown', this);
    this._input.addEventListener('blur', this);
    this._input.addEventListener('focus', this);
  }

  /**
   * Handle `before-detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    this._input.removeEventListener('keydown', this);
    this._input.removeEventListener('blur', this);
    this._input.removeEventListener('focus', this);
  }

  private _browser: FileBrowser;
  private _path = '';
  private _pathChanged = new Signal<
    this,
    { newValue: string; oldValue: string }
  >(this);
  private _input: HTMLInputElement;
}

/**
 * A widget hosting an error panel for the browser,
 * used if there is an invalid file path
 */
export class HdfErrorPanel extends Widget {
  constructor(message: string) {
    super();
    this.addClass('jp-HdfErrorPanel');
    const image = document.createElement('div');
    const text = document.createElement('div');
    image.className = 'jp-HdfErrorImage';
    text.className = 'jp-HdfErrorText';
    text.textContent = message;
    this.node.appendChild(image);
    this.node.appendChild(text);
  }
}
