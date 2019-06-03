/**
 * Copyright (C) 2019 Mailvelope GmbH
 * Licensed under the GNU Affero General Public License version 3
 */

import React from 'react';
import PropTypes from 'prop-types';
import * as l10n from '../../lib/l10n';
import {showSecurityBackground, formatFpr} from '../../lib/util';
import EventHandler from '../../lib/EventHandler';
import Spinner from '../util/Spinner';
import Alert from '../util/Alert';

// register language strings
l10n.register([
  'key_import_default_headline',
  'key_import_default_description',
  'key_import_invalidated_description',
  'keyring_confirm_keys',
  'keygrid_keyid',
  'keygrid_user_name',
  'keygrid_user_email',
  'keygrid_key_fingerprint',
  'form_confirm',
  'form_cancel'
]);

export default class ImportKey extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      waiting: true,
      key: null,
      invalidated: false,
      error: null,
      showError: false
    };
    this.handleCancel = this.handleCancel.bind(this);
    this.handleConfirm = this.handleConfirm.bind(this);
    this.port = EventHandler.connect(`dDialog-${this.props.id}`, this);
    this.registerEventListeners();
    // emit event to backend that key import dialog has initialized
    this.port.emit('key-import-dialog-init');
  }

  componentDidMount() {
    if (this.props.secureBackground) {
      showSecurityBackground(this.port, true);
    }
  }

  registerEventListeners() {
    this.port.on('key-details', this.onKeyDetails);
    this.port.on('import-error', this.onImportError);
  }

  onKeyDetails({key, invalidated}) {
    this.setState({key, invalidated, waiting: false});
  }

  onImportError({message}) {
    this.showErrorMsg({error: message});
  }

  showErrorMsg({error}) {
    this.setState({
      error: {
        header: l10n.map.alert_header_error,
        message: error,
        type: 'danger'
      },
      waiting: false,
      showError: true
    });
  }

  logUserInput(type) {
    this.port.emit('key-import-user-input', {
      source: 'security_log_import_dialog',
      type
    });
  }

  handleCancel() {
    this.logUserInput('security_log_dialog_cancel');
    this.port.emit('key-import-dialog-cancel');
    this.setState({showError: false});
  }

  handleConfirm() {
    this.logUserInput('security_log_dialog_ok');
    this.port.emit('key-import-dialog-ok');
  }

  render() {
    return (
      <div className="modal d-block p-5">
        <div className="modal-dialog h-100 mw-100 m-0">
          <div className="modal-content shadow-lg border-0 h-100">
            {this.state.waiting ? (
              <Spinner style={{margin: 'auto auto'}} />
            ) : (
              <>
                <div className="modal-header justify-content-center border-0 p-4 flex-shrink-0">
                  <h4 className="modal-title">{l10n.map.key_import_default_headline}</h4>
                </div>
                <div className="modal-body overflow-auto py-0 px-4">
                  <p>{!this.state.invalidated ? l10n.map.key_import_default_description : l10n.get('key_import_invalidated_description', [this.state.key.email ? this.state.key.email : this.state.key.name])}</p>
                  {!this.state.showError ? (
                    <div className="table-responsive">
                      <table className="table table-custom">
                        <thead>
                          <tr>
                            <th></th>
                            <th>{l10n.map.keygrid_keyid}</th>
                            <th>{l10n.map.keygrid_user_name}</th>
                            <th>{l10n.map.keygrid_user_email}</th>
                            <th>{l10n.map.keygrid_key_fingerprint}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {this.state.key.users.map((user, userIndex) =>
                            <tr key={userIndex} tabIndex="0" aria-haspopup="true" className={userIndex === 0 && this.state.key.users.length > 1 ? 'accent' : ''}>
                              <td className={`align-middle ${userIndex !== 0 ? 'border-top-0' : ''}`}>
                                {userIndex === 0 && <span className={`icon icon-${this.state.key.type === 'public' ? 'key' : 'key-pair'}`} style={{fontSize: '1.25rem'}}></span>}
                              </td>
                              <td className={`monospaced text-nowrap small text-break align-middle ${userIndex !== 0 ? 'border-top-0' : ''}`}>{userIndex === 0 ? this.state.key.keyId : ''}</td>
                              <td className={`align-middle ${userIndex !== 0 ? 'border-top-0' : ''}`}>{user.name}</td>
                              <td className={`align-middle ${userIndex !== 0 ? 'border-top-0' : ''}`}>{user.email}</td>
                              <td style={{maxWidth: '180px'}} className={`monospaced text-muted small text-break align-middle ${userIndex !== 0 ? 'border-top-0' : ''}`}>{userIndex === 0 ? formatFpr(this.state.key.fingerprint) : ''}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Alert header={this.state.error.header} type={this.state.error.type}>{this.state.error.message}</Alert>
                  )}
                </div>
                <div className="modal-footer justify-content-center border-0 p-4 flex-shrink-0">
                  <div className="btn-bar">
                    <button type="button" onClick={this.handleCancel} className="btn btn-secondary">{l10n.map.form_cancel}</button>
                    <button type="button" onClick={this.handleConfirm} className="btn btn-primary">{l10n.map.keyring_confirm_keys}</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
}

ImportKey.propTypes = {
  id: PropTypes.string,
  secureBackground: PropTypes.bool,
  isContainer: PropTypes.bool
};

ImportKey.defaultProps = {
  secureBackground: true
};