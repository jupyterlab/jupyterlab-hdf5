// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { convertValuesToString, isComplexDtype } from './complex';
import { AttributeValue } from './hdf';

interface IAttribute {
  dtype: string;
  name: string;
  value: AttributeValue;
}

class AttributeViewer extends ReactWidget {
  readonly attributes: IAttribute[];

  constructor(attributes: IAttribute[]) {
    super();
    this.attributes = attributes;
    this.addClass('jhdf-attribute-table-container');
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
          {this.attributes.length === 0 ? (
            <tr>
              <td>No attributes.</td>
            </tr>
          ) : (
            this.attributes.map(({ name, value, dtype }): JSX.Element => {
              const valueToDisplay = isComplexDtype(dtype)
                ? convertValuesToString(value)
                : value;
              return (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{JSON.stringify(valueToDisplay, null, ' ')}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    );
  }
}

export default AttributeViewer;
