// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import * as React from "react";

import { DataGrid } from "@phosphor/datagrid";

import { ReactWidget } from "@jupyterlab/apputils";

import { HdfDatasetModelBase } from "./dataset";

const TOOLBAR_SLICEINPUT_CLASS = ".jp-SliceInputToolbar";
const TOOLBAR_SLICEINPUT_BOX_CLASS = ".jp-SliceInputToolbar-box";

/**
 * A namespace for SliceInput statics.
 */
namespace SliceInput {
  /**
   * The props for SliceInput.
   */
  export interface IProps {
    handleEnter: (val: string) => void;
  }

  /**
   * The props for SliceInput.
   */
  export interface IState {
    /**
     * The current value of the form.
     */
    value: string;

    /**
     * Whether the form has focus.
     */
    hasFocus: boolean;
  }
}

export class SliceInput extends ReactWidget {
  /**
   * Construct a new text input for a slice.
   */
  constructor(widget: DataGrid) {
    super();
    this.addClass(TOOLBAR_SLICEINPUT_CLASS);

    this._grid = widget;
    this._model = this._grid.dataModel as HdfDatasetModelBase;
  }

  render() {
    return <SliceInputBox handleEnter={val => (this._model.slice = val)} />;
  }

  private _grid: DataGrid;
  private _model: HdfDatasetModelBase;
}

export class SliceInputBox extends React.Component<
  SliceInput.IProps,
  SliceInput.IState
> {
  /**
   * Construct a new cell type switcher.
   */
  constructor(props: SliceInput.IProps) {
    super(props);
    this.state = {
      value: ":, :",
      hasFocus: false
    };
  }

  /**
   * Focus the element on mount.
   */
  componentDidMount() {
    this._textInput!.focus();
  }

  /**
   * Handle `keydown` events for the HTMLSelect component.
   */
  private _handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ): void => {
    if (event.keyCode === 13) {
      this.props.handleEnter(event.currentTarget.value);
    }
  };

  /**
   * Handle a change to the value in the input field.
   */
  private _handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ value: event.currentTarget.value });
  };

  /**
   * Handle focusing of the input field.
   */
  private _handleFocus = () => {
    this.setState({ hasFocus: true });
  };

  /**
   * Handle blurring of the input field.
   */
  private _handleBlur = () => {
    this.setState({ hasFocus: false });
  };

  render() {
    return (
      <label title={"Use Numpy syntax. 2D slices only"}>
        {"Slice: "}
        <input
          type="text"
          className={TOOLBAR_SLICEINPUT_BOX_CLASS}
          onChange={this._handleChange}
          onFocus={this._handleFocus}
          onBlur={this._handleBlur}
          onKeyDown={this._handleKeyDown}
          aria-label="Slice input"
          value={this.state.value}
          ref={input => {
            this._textInput = input;
          }}
        />
      </label>
    );
  }

  private _textInput: HTMLInputElement | null = null;
}
