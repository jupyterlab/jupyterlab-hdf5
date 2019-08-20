/**
 * A toolbar widget that switches cell types.
 */
import * as React from "react";

import { DataGrid } from "@phosphor/datagrid";

import { ReactWidget } from "@jupyterlab/apputils";

import { HdfDatasetModelBase } from "./dataset";

const TOOLBAR_SLICEINPUT_CLASS = ".jp-SliceInputToolbar";
const TOOLBAR_SLICEINPUT_BOX_CLASS = ".jp-SliceInputToolbar-box";

export class SliceInput extends ReactWidget {
  /**
   * Construct a new cell type switcher.
   */
  constructor(widget: DataGrid) {
    super();
    this.addClass(TOOLBAR_SLICEINPUT_CLASS);

    this._grid = widget;
    this._model = this._grid.model as HdfDatasetModelBase;
  }

  /**
   * Handle `keydown` events for the HTMLSelect component.
   */
  handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.keyCode === 13) {
      this._model.slice = event.currentTarget.value;
    }
  };

  render() {
    let value = this._model.slice;

    return (
      <label>
        {"Slice: "}
        <input
          type="text"
          className={TOOLBAR_SLICEINPUT_BOX_CLASS}
          onKeyDown={this.handleKeyDown}
          aria-label="Slice input"
          value={value}

          // className={lineFormInput}
          // onChange={this._handleChange}
          // onFocus={this._handleFocus}
          // onBlur={this._handleBlur}
          // ref={input => {
          //   this._textInput = input;
          // }}
        />
      </label>
    );
  }

  private _grid: DataGrid;
  private _model: HdfDatasetModelBase;
}
