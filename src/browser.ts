// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

// import { ToolbarButton } from '@jupyterlab/apputils';

import { FileBrowser } from "@jupyterlab/filebrowser";

import { Message } from "@phosphor/messaging";

import { ISignal, Signal } from "@phosphor/signaling";

import { PanelLayout, Widget } from "@phosphor/widgets";

import { HdfDrive, parsePath } from "./contents";

/**
 * Widget for hosting the Hdf filebrowser.
 */
export class HdfFileBrowser extends Widget {
  constructor(browser: FileBrowser, drive: HdfDrive) {
    super();
    this.addClass("jp-HdfBrowser");
    this.layout = new PanelLayout();
    (this.layout as PanelLayout).addWidget(browser);
    this._browser = browser;
    this._drive = drive;

    // Create an editable name for the user/org name.
    this.fpath = new hdfFpathInput();
    this.fpath.node.title = "Click to edit user/organization";
    this._browser.toolbar.addItem("user", this.fpath);
    this.fpath.nameChanged.connect(this._onFpathChanged, this);

    // // Add our own refresh button, since the other one is hidden
    // // via CSS.
    // let refresher = new ToolbarButton({
    //   iconClassName: 'jp-RefreshIcon jp-Icon jp-Icon-16',
    //   onClick: () => {
    //     this._browser.model.refresh();
    //   },
    //   tooltip: 'Refresh File List'
    // });
    // refresher.addClass('jp-GitHub-toolbar-item');
    // this._browser.toolbar.addItem('gh-refresher', refresher);
  }

  /**
   * An editable widget hosting the current user name.
   */
  readonly fpath: hdfFpathInput;

  /**
   * React to a change in user.
   */
  private _onFpathChanged() {
    if (this._changeGuard) {
      return;
    }
    this._changeGuard = true;
    this._browser.model.cd(`/${this.fpath.name}`).then(() => {
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
  private _updateErrorPanel(): void {
    const localPath = this._browser.model.manager.services.contents.localPath(
      this._browser.model.path
    );
    const resource = parsePath(localPath);
    const validFile = this._drive.validFile;

    // If we currently have an error panel, remove it.
    if (this._errorPanel) {
      const listing = (this._browser.layout as PanelLayout).widgets[2];
      listing.node.removeChild(this._errorPanel.node);
      this._errorPanel.dispose();
      this._errorPanel = null;
    }

    // If we have an invalid user, make an error panel.
    if (!validFile) {
      const message = `No file found at path: ${resource.fpath}`;
      this._errorPanel = new HdfErrorPanel(message);
      const listing = (this._browser.layout as PanelLayout).widgets[2];
      listing.node.appendChild(this._errorPanel.node);
      return;
    }
  }

  private _browser: FileBrowser;
  private _drive: HdfDrive;
  private _errorPanel: HdfErrorPanel | null;
  private _changeGuard = false;
}

/**
 * A widget that hosts an editable field,
 * used to host the currently active GitHub
 * user name.
 */
export class hdfFpathInput extends Widget {
  constructor() {
    super();
    this.addClass("jp-GitHubUserInput");
    const layout = (this.layout = new PanelLayout());
    const wrapper = new Widget();
    wrapper.addClass("jp-GitHubUserInput-wrapper");
    this._input = document.createElement("input");
    this._input.placeholder = "GitHub User";
    this._input.className = "jp-GitHubUserInput-input";
    wrapper.node.appendChild(this._input);
    layout.addWidget(wrapper);
  }

  /**
   * The current name of the field.
   */
  get name(): string {
    return this._name;
  }
  set name(value: string) {
    if (value === this._name) {
      return;
    }
    const old = this._name;
    this._name = value;
    this._input.value = value;
    this._nameChanged.emit({
      oldValue: old,
      newValue: value
    });
  }

  /**
   * A signal for when the name changes.
   */
  get nameChanged(): ISignal<this, { newValue: string; oldValue: string }> {
    return this._nameChanged;
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
        switch (event.keyCode) {
          case 13: // Enter
            event.stopPropagation();
            event.preventDefault();
            this.name = this._input.value;
            this._input.blur();
            break;
          default:
            break;
        }
        break;
      case "blur":
        event.stopPropagation();
        event.preventDefault();
        this.name = this._input.value;
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

  private _name = "";
  private _nameChanged = new Signal<
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
    this.addClass("jp-GitHubErrorPanel");
    const image = document.createElement("div");
    const text = document.createElement("div");
    image.className = "jp-GitHubErrorImage";
    text.className = "jp-GitHubErrorText";
    text.textContent = message;
    this.node.appendChild(image);
    this.node.appendChild(text);
  }
}
