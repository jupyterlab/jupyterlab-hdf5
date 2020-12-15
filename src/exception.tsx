// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Dialog, showDialog } from "@jupyterlab/apputils";
import { ServerConnection } from "@jupyterlab/services";
import { ReadonlyJSONObject } from "@lumino/coreutils";

import * as React from "react";

const HDF_MODAL_TEXT_CLASS = "jhdf-errorModal-text";

export class HdfResponseError extends ServerConnection.ResponseError {
  /**
   * Create a new response error.
   */
  constructor({
    response,
    message = `Invalid response: ${response.status} ${response.statusText}`,
    debugVars = {},
    traceback = ""
  }: {
    response: Response;
    message: string;
    debugVars: ReadonlyJSONObject;
    traceback: string;
  }) {
    super(response, message);
    this.debugVars = debugVars;
    this.traceback = traceback;
  }

  debugVars: ReadonlyJSONObject;
  traceback: string;
}

export function modalHdfError(
  error: HdfResponseError,
  buttons: ReadonlyArray<Dialog.IButton> = [
    Dialog.okButton({ label: "Dismiss" })
  ]
) {
  const { message, debugVars, traceback } = error;
  console.warn({ message, debugVars, traceback });

  return showDialog({
    title: "jupyterlab-hdf error",
    body: (
      <div className={HDF_MODAL_TEXT_CLASS}>
        <div>{message}</div>
      </div>
    ),
    buttons: buttons
  });
}

export function modalResponseError(
  error: ServerConnection.ResponseError,
  buttons: ReadonlyArray<Dialog.IButton> = [
    Dialog.okButton({ label: "Dismiss" })
  ]
) {
  const { message, traceback } = error;
  console.warn({ message, traceback });

  return showDialog({
    title: "jupyterlab-hdf error",
    body: (
      <div className={HDF_MODAL_TEXT_CLASS}>
        <div>message</div>
        <div>{message}</div>
        <div>traceback</div>
        <div>{traceback}</div>
      </div>
    ),
    buttons: buttons
  });
}

export function modalValidationFail(
  message: string,
  buttons: ReadonlyArray<Dialog.IButton> = [
    Dialog.okButton({ label: "Dismiss" })
  ]
) {
  return showDialog({
    title: "jupyterlab-hdf error",
    body: (
      <div className={HDF_MODAL_TEXT_CLASS}>
        <div>{message}</div>
      </div>
    ),
    buttons: buttons
  });
}
