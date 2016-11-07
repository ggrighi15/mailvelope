/**
 * Mailvelope - secure email with OpenPGP encryption for Webmail
 * Copyright (C) 2013-2015 Mailvelope GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

var mvelo = mvelo || {};

mvelo.ExtractFrame = function(prefs) {
  if (!prefs) {
    throw {
      message: 'mvelo.ExtractFrame constructor: prefs not provided.'
    };
  }
  this.id = mvelo.util.getHash();
  // element with Armor Tail Line '-----END PGP...'
  this._pgpEnd = null;
  // element that contains complete ASCII Armored Message
  this._pgpElement = null;
  this._pgpElementAttr = {};
  this._eFrame = null;
  this._port = null;
  this._refreshPosIntervalID = null;
  this._pgpStartRegex = /BEGIN\sPGP/;
};

mvelo.ExtractFrame.prototype.attachTo = function(pgpEnd) {
  this._init(pgpEnd);
  this._establishConnection();
  this._renderFrame();
  this._registerEventListener();
};

mvelo.ExtractFrame.prototype._init = function(pgpEnd) {
  this._pgpEnd = pgpEnd;
  // find element with complete armored text and width > 0
  this._pgpElement = pgpEnd;
  var maxNesting = 8;
  var beginFound = false;
  for (var i = 0; i < maxNesting; i++) {
    if (this._pgpStartRegex.test(this._pgpElement.text()) &&
        this._pgpElement.width() > 0) {
      beginFound = true;
      break;
    }
    this._pgpElement = this._pgpElement.parent();
    if (this._pgpElement.get(0).nodeName === 'HTML') {
      break;
    }
  }
  // set status to attached
  this._pgpEnd.data(mvelo.FRAME_STATUS, mvelo.FRAME_ATTACHED);
  // store frame obj in pgpText tag
  this._pgpEnd.data(mvelo.FRAME_OBJ, this);

  if (!beginFound) {
    throw new Error('Missing BEGIN PGP header.');
  }

  this._pgpElementAttr.marginTop = parseInt(this._pgpElement.css('margin-top'), 10);
  this._pgpElementAttr.paddingTop = parseInt(this._pgpElement.css('padding-top'), 10);
};

mvelo.ExtractFrame.prototype._renderFrame = function() {
  var that = this;
  this._eFrame = $('<div/>', {
    id: 'eFrame-' + this.id,
    'class': 'm-extract-frame m-cursor',
    html: '<a class="m-frame-close">×</a>'
  });

  this._setFrameDim();

  this._eFrame.insertAfter(this._pgpElement);
  if (this._pgpElement.height() > mvelo.LARGE_FRAME) {
    this._eFrame.addClass('m-large');
  }
  this._eFrame.fadeIn('slow');

  this._eFrame.on('click', this._clickHandler.bind(this));
  this._eFrame.find('.m-frame-close').on('click', this._closeFrame.bind(this));

  $(window).resize(this._setFrameDim.bind(this));
  this._refreshPosIntervalID = window.setInterval(function() {
    that._setFrameDim();
  }, 1000);
};

mvelo.ExtractFrame.prototype._clickHandler = function(callback) {
  this._eFrame.off('click');
  this._toggleIcon(callback);
  this._eFrame.removeClass('m-cursor');
  return false;
};

mvelo.ExtractFrame.prototype._closeFrame = function(finalClose) {
  this._eFrame.fadeOut(function() {
    window.clearInterval(this._refreshPosIntervalID);
    $(window).off('resize');
    this._eFrame.remove();
    if (finalClose === true) {
      this._port.disconnect();
      this._pgpEnd.data(mvelo.FRAME_STATUS, null);
    } else {
      this._pgpEnd.data(mvelo.FRAME_STATUS, mvelo.FRAME_DETACHED);
    }
    this._pgpEnd.data(mvelo.FRAME_OBJ, null);
  }.bind(this));
  return false;
};

mvelo.ExtractFrame.prototype._toggleIcon = function(callback) {
  this._eFrame.one('transitionend', callback);
  this._eFrame.toggleClass('m-open');
};

mvelo.ExtractFrame.prototype._setFrameDim = function() {
  var pgpElementPos = this._pgpElement.position();
  this._eFrame.width(this._pgpElement.width() - 2);
  this._eFrame.height(this._pgpEnd.position().top + this._pgpEnd.height() - pgpElementPos.top - 2);
  this._eFrame.css('top', pgpElementPos.top + this._pgpElementAttr.marginTop + this._pgpElementAttr.paddingTop);
};

mvelo.ExtractFrame.prototype._establishConnection = function() {
  this._port = mvelo.extension.connect({name: this._ctrlName});
  //console.log('Port connected: %o', this._port);
};

mvelo.ExtractFrame.prototype._getArmoredMessage = function() {
  var msg;
  // selection method does not work in Firefox if pre element without linebreaks with <br>
  if (this._pgpElement.is('pre') && !this._pgpElement.find('br').length) {
    msg = this._pgpElement.text();
  } else {
    var element = this._pgpElement.get(0);
    var sel = element.ownerDocument.defaultView.getSelection();
    sel.selectAllChildren(element);
    msg = sel.toString();
    sel.removeAllRanges();
  }
  return msg;
};

mvelo.ExtractFrame.prototype._getPGPMessage = function() {
  var msg = this._getArmoredMessage();
  // additional filtering to get well defined PGP message format
  msg = msg.replace(/\n\s+/g, '\n'); // compress sequence of whitespace and new line characters to one new line
  msg = msg.match(this._typeRegex)[0];
  msg = msg.replace(/^(\s?>)+/gm, ''); // remove quotation
  msg = msg.replace(/^\s+/gm, ''); // remove leading whitespace
  msg = msg.replace(/:.*\n(?!.*:)/, '$&\n');  // insert new line after last armor header
  msg = msg.replace(/-----\n(?!.*:)/, '$&\n'); // insert new line if no header
  msg = mvelo.util.decodeQuotedPrint(msg);
  return msg;
};

mvelo.ExtractFrame.prototype._registerEventListener = function() {
  var that = this;
  this._port.onMessage.addListener(function(msg) {
    switch (msg.event) {
      case 'destroy':
        that._closeFrame(true);
        break;
    }
  });
  this._port.onDisconnect.addListener(function() {
    that._closeFrame(false);
  });
};

mvelo.ExtractFrame.isAttached = function(pgpEnd) {
  var status = pgpEnd.data(mvelo.FRAME_STATUS);
  switch (status) {
    case mvelo.FRAME_ATTACHED:
    case mvelo.FRAME_DETACHED:
      return true;
    default:
      return false;
  }
};