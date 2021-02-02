// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import React from "react";
import { ReactWidget } from "@jupyterlab/apputils";

class AttributeViewer extends ReactWidget {
  readonly attributes: Record<string, any>;

  constructor(attributes: Record<string, any>) {
    super();
    this.attributes = attributes;
  }

  render(): JSX.Element {
    return (
      <table className="jhdf-attribute-table">
        <thead>
          <tr>
            <th scope="col" colSpan={2}>
              Attributes
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(this.attributes).map(
            ([name, value]): JSX.Element => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{JSON.stringify(value)}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    );
  }
}

export default AttributeViewer;
