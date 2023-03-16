// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Message } from "@lumino/messaging";

import { ISignal, Signal } from "@lumino/signaling";

import { PanelLayout, Widget } from "@lumino/widgets";

// import { ToolbarButton } from '@jupyterlab/apputils';

import { FileBrowser } from "@jupyterlab/filebrowser";

import { HdfDrive } from "./contents";
import { localAbsPath, parseHdfQuery } from "./hdf";

const FACTORY = "HDF Dataset";
const DATA_MIME = "application/x-hdf5.dataset";

/**
 * Widget for hosting the Hdf filebrowser.
 */
export class HdfSidepanel extends Widget {
  constructor(browser: FileBrowser, drive: HdfDrive) {
    super();
    this.addClass("jhdf-sidepanel");
    this.layout = new PanelLayout();
    (this.layout as PanelLayout).addWidget(browser);
    this._browser = browser;
    this._drive = drive;

    this._monkeyPatch();

    // Create an editable name for the Hdf file path.
    this.fpathInput = new hdfFpathInput(browser);
    this.fpathInput.node.title = "Click to edit file path";
    this._browser.toolbar.addItem("fpathInput", this.fpathInput);
    this.fpathInput.pathChanged.connect(this._onFpathChanged, this);

    // // Add our own refresh button, since the other one is hidden
    // // via CSS.
    // let refresher = new ToolbarButton({
    //   iconClassName: 'jp-RefreshIcon jp-Icon jp-Icon-16',
    //   onClick: () => {
    //     this._browser.model.refresh();
    //   },
    //   tooltip: 'Refresh File List'
    // });
    // refresher.addClass('jhdf-toolbar-item');
    // this._browser.toolbar.addItem('gh-refresher', refresher);
  }

  /**
   * An editable widget hosting the current file path.
   */
  readonly fpathInput: hdfFpathInput;

  /**
   * The inner filebrowser widget that HdfSidepanel wraps
   */
  get browser(): FileBrowser {
    return this._browser;
  }

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
      if (!item) {
        return;
      }
      if (item.type === "directory") {
        this._browser.model
          .cd(localAbsPath(item.path))
          .catch(error => console.error(error));
      } else {
        const factory = item.mimetype === DATA_MIME ? FACTORY : "default";
        this._browser.model.manager.openOrReveal(item.path, factory);
      }
    };

    const listing = (this._browser.layout as PanelLayout).widgets[3];
    listing.node.addEventListener("dblclick", handleDblClick, true);
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
      .cd(`/${this.fpathInput.path}`)
      .then(() => {
        this._changeGuard = false;
        this._updateErrorPanel();
        // Once we have the new listing, maybe give the file listing
        // focus. Once the input element is removed, the active element
        // appears to revert to document.body. If the user has subsequently
        // focused another element, don't focus the browser listing.
        if (document.activeElement === document.body) {
          const listing = (this._browser.layout as PanelLayout).widgets[3];
          listing.node.focus();
        }
      })
      .catch((err: Error) => {
        const msg =
          `Failed to open HDF5 file at ${this.fpathInput.path}` + err.message;
        console.error(msg);
        this._updateErrorPanel(err);
      });
  }

  /**
   * React to a change in the validity of the hdf file.
   */
  private _updateErrorPanel(err?: Error): void {
    const localPath = this._browser.model.manager.services.contents.localPath(
      this._browser.model.path
    );
    const params = parseHdfQuery(localPath);

    // If we currently have an error panel, remove it.
    if (this._errorPanel) {
      const listing = (this._browser.layout as PanelLayout).widgets[3];
      listing.node.removeChild(this._errorPanel.node);
      this._errorPanel.dispose();
      this._errorPanel = null;
    }

    if (err) {
      const msg =
        `Failed to open HDF5 file at ${this.fpathInput.path}` + err.message;
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
    const listing = (this._browser.layout as PanelLayout).widgets[3];
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

    this.addClass("jhdf-userInput");
    const layout = (this.layout = new PanelLayout());
    const wrapper = new Widget();
    wrapper.addClass("jhdf-userInput-wrapper");
    this._input = document.createElement("input");
    this._input.placeholder = "HDF5 Path";
    this._input.className = "jhdf-userInput-input";
    wrapper.node.appendChild(this._input);
    layout.addWidget(wrapper);

    // restore the input from browser path
    this._syncInputToBrowser();

    // sync to future changes to browser path
    this._browser.model.pathChanged.connect(this._onBrowserPathChanged, this);
  }

  /**
   * The current name of the field.
   */
  get path(): string {
    return this._input.value;
  }
  set path(val: string) {
    if (val === this._browser.model.path) {
      return;
    }

    const old = this._path;
    this._input.value = val;

    this._pathChanged.emit({
      oldValue: old,
      newValue: val
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
      case "keydown":
        if (event.key === "Enter") {
          event.stopPropagation();
          event.preventDefault();
          this.path = this._input.value;
          this._input.blur();
        }
        break;
      case "blur":
        event.stopPropagation();
        event.preventDefault();
        this.path = this._input.value;
        break;
      case "focus":
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
    this._input.addEventListener("keydown", this);
    this._input.addEventListener("blur", this);
    this._input.addEventListener("focus", this);
  }

  /**
   * Handle `before-detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    this._input.removeEventListener("keydown", this);
    this._input.removeEventListener("blur", this);
    this._input.removeEventListener("focus", this);
  }

  private _syncInputToBrowser() {
    const { fpath } = parseHdfQuery(this._browser.model.path);
    this._path = fpath;
    this._input.value = fpath;
  }

  private _onBrowserPathChanged() {
    if (this._path === this._browser.model.path) {
      return;
    }

    this._syncInputToBrowser();
  }

  private _browser: FileBrowser;
  private _path = "";
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
    this.addClass("jhdf-errorPanel");
    const image = document.createElement("div");
    const text = document.createElement("div");
    image.className = "jhdf-errorPanel-image";
    text.className = "jhdf-errorPanel-text";
    text.textContent = message;
    this.node.appendChild(image);
    this.node.appendChild(text);
  }
}
