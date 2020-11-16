// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { DataGrid } from "@lumino/datagrid";

import { ISignal } from "@lumino/signaling";

import { ReactWidget } from "@jupyterlab/apputils";

import * as React from "react";

import { HdfDatasetModelBase } from "./dataset";

const TOOLBAR_IX_INPUT_CLASS = ".jp-IxInputToolbar";
const TOOLBAR_IX_INPUT_BOX_CLASS = ".jp-IxInputToolbar-box";

/**
 * A namespace for IxInput statics.
 */
namespace IxInputBox {
  /**
   * The props for IxInput.
   */
  export interface IProps {
    handleEnter: (val: string) => void;

    initialValue: string;

    signal: ISignal<any, string>;
  }

  /**
   * The props for IxInput.
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

export class IxInput extends ReactWidget {
  /**
   * Construct a new text input for a slice.
   */
  constructor(widget: DataGrid) {
    super();
    this.addClass(TOOLBAR_IX_INPUT_CLASS);

    this._grid = widget;
    this._model = this._grid.dataModel as HdfDatasetModelBase;
  }

  render() {
    return (
      <IxInputBox
        handleEnter={val => (this._model.ixstr = val)}
        initialValue={this._model.ixstr}
        signal={this._model.refreshed}
      />
    );
  }

  private _grid: DataGrid;
  private _model: HdfDatasetModelBase;
}

export class IxInputBox extends React.Component<
  IxInputBox.IProps,
  IxInputBox.IState
> {
  /**
   * Construct a new cell type switcher.
   */
  constructor(props: IxInputBox.IProps) {
    super(props);
    this.state = {
      value: this.props.initialValue,
      hasFocus: false
    };
  }

  /**
   * Attach the value change signal and focus the element on mount.
   */
  componentDidMount() {
    this.props.signal.connect(this._slot);
    this._textInput!.focus();
  }

  /**
   * detach the value change signal on unmount
   */
  componentWillUnmount() {
    this.props.signal.disconnect(this._slot);
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

  private _slot = (_: any, args: string) => {
    // skip setting new state if incoming val is equal to existing value
    if (args === this.state.value) {
      return;
    }

    this.setState({ value: args });
  };

  render() {
    return (
      <label title={"Use Numpy syntax. 2D slices only"}>
        {"Slice: "}
        <input
          type="text"
          className={TOOLBAR_IX_INPUT_BOX_CLASS}
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
