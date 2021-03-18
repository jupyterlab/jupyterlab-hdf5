// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { DataGrid } from '@lumino/datagrid';

import { ISignal } from '@lumino/signaling';

import { ReactWidget } from '@jupyterlab/apputils';

import * as React from 'react';

import { HdfDatasetModel } from './dataset';

const TOOLBAR_IX_INPUT_CLASS = '.jp-IxInputToolbar';
const TOOLBAR_IX_INPUT_BOX_CLASS = '.jp-IxInputToolbar-box';

/**
 * a namespace for IxInputBox statics
 */
namespace IxInputBox {
  /**
   * the props for IxInputBox
   */
  export interface IProps {
    /**
     * function run when enter key is pressed in input box
     */
    handleEnter: (val: string) => void;

    /**
     * initial value shown in input box
     */
    initialValue?: string;

    /**
     * signal by which input value can be updated.
     * Updates the value in an isolated way, without
     * triggering eg handleEnter
     */
    signal: ISignal<any, string>;
  }

  /**
   * the state for IxInputBox
   */
  export interface IState {
    /**
     * the current value of the input box
     */
    value: string;

    /**
     * whether the input box has focus
     */
    hasFocus: boolean;
  }
}

export class IxInput extends ReactWidget {
  /**
   * construct a new text input for an index
   */
  constructor(widget: DataGrid) {
    super();
    this.addClass(TOOLBAR_IX_INPUT_CLASS);

    this._grid = widget;
    this._model = this._grid.dataModel as HdfDatasetModel;
  }

  render(): JSX.Element {
    return (
      <IxInputBox
        handleEnter={val => (this._model.ixstr = val)}
        initialValue={this._model.ixstr}
        signal={this._model.refreshed}
      />
    );
  }

  private _grid: DataGrid;
  private _model: HdfDatasetModel;
}

export class IxInputBox extends React.Component<
  IxInputBox.IProps,
  IxInputBox.IState
> {
  /**
   * construct a new input box for an index
   */
  constructor(props: IxInputBox.IProps) {
    super(props);
    this.state = {
      value: this.props.initialValue || '',
      hasFocus: false,
    };
  }

  /**
   * attach the value change signal and focus the element on mount
   */
  componentDidMount(): void {
    this.props.signal.connect(this._slot);
    this._textInput!.focus();
  }

  /**
   * detach the value change signal on unmount
   */
  componentWillUnmount(): void {
    this.props.signal.disconnect(this._slot);
  }

  /**
   * handle `keydown` events for the HTMLSelect component
   */
  private _handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ): void => {
    if (event.key === 'Enter') {
      this.props.handleEnter(event.currentTarget.value);
    }
  };

  /**
   * handle a change to the value in the input field
   */
  private _handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ value: event.currentTarget.value });
  };

  /**
   * handle focusing of the input field
   */
  private _handleFocus = () => {
    this.setState({ hasFocus: true });
  };

  /**
   * handle blurring of the input field
   */
  private _handleBlur = () => {
    this.setState({ hasFocus: false });
  };

  /**
   * update value on signal emit
   */
  private _slot = (_: any, args: string) => {
    // skip setting new state if incoming val is equal to existing value
    if (args === this.state.value) {
      return;
    }

    this.setState({ value: args });
  };

  render(): JSX.Element {
    return (
      <label title={'Use Numpy syntax. 2D slices only'}>
        {'Slice: '}
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
