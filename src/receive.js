///////////////////////////////////////////////////////////////////////////
// receive.js
//
// socketcan input node.
//
// This file is part of the VSCP (https://www.vscp.org)
//
// The MIT License (MIT)
//
// Copyright © 2020-2026 Ake Hedman, Grodans Paradis AB
// <info@grodansparadis.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//

module.exports = function(RED) {
  'use strict';

  // Debug:
  // https://nodejs.org/api/util.html
  // export NODE_DEBUG=socketcan-out  for all debug events
  const util = require('util');
  const debuglog = util.debuglog('socketcan-out');

  var can = require('socketcan');

  function SocketcanReceiveNode(config) {
    RED.nodes.createNode(this, config);

    this.config = RED.nodes.getNode(config.config);

    if (this.config) {
      this.interface = this.config.interface;
    } else {
      return;  // Do nothing
               // this.interface="vcan0";
    }

    debuglog('CAN interface = ' + this.interface);

    // Tell the world that we are connecting to the interface
    this.status({
      fill: 'yellow',
      shape: 'dot',
      text: 'connecting... ' +
          '<' + this.interface + '>'
    });

    var node = this;
    var sock;
    var reconnectTimer;
    var closing = false;
    var reconnectInterval = 1000; // 1 second

    function onMessage(frame) {
      debuglog('CAN message :', frame);
      var msg = {};
      msg.payload = {};
      msg.payload.timestamp = frame.timestamp || new Date().getTime();
      msg.payload.ext = frame.ext || false;
      msg.payload.canid = frame.id;
      msg.payload.dlc = frame.data.length;
      msg.payload.rtr = frame.rtr || false;
      msg.payload.data = [];
      msg.payload.err = frame.err || false;
      msg.payload.data = Array.prototype.slice.call(frame.data, 0);
      msg.payload.rawData = frame.data;
      node.send(msg);
    }

    function stopSocketOnly() {
      if (!sock) {
        return;
      }

      var currentSock = sock;
      sock = null;

      if (currentSock.removeListener) {
        currentSock.removeListener('onMessage', onMessage);
      }

      try {
        currentSock.stop();
      } catch (err) {
        debuglog('Error stopping socket on ' + node.interface + ': ' + err.message);
      }
    }

    function recoverSocket(reason) {
      if (closing) {
        return;
      }

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      debuglog('Manual socket recovery on ' + node.interface + ': ' + reason);
      node.status({fill:'yellow',shape:'dot',text:'reconnecting...<' + node.interface + '>'});

      stopSocketOnly();

      reconnectTimer = setTimeout(function() {
        reconnectTimer = null;
        initSocket();
      }, reconnectInterval);
    }

    function isUnsupportedOptionError(err) {
      return err && err.message && err.message.toLowerCase().indexOf('not supported') !== -1;
    }

    function startChannel(receiveErrorFrames) {
      var channelOptions = receiveErrorFrames ? {timestamps: true, receive_error_frames: true} : true;
      var channel = can.createRawChannel('' + node.interface, channelOptions);

      channel.addListener('onMessage', onMessage);

      try {
        channel.start();
      } catch (err) {
        if (channel.removeListener) {
          channel.removeListener('onMessage', onMessage);
        }

        try {
          channel.stop();
        } catch (stopErr) {
          debuglog('Error stopping failed socket on ' + node.interface + ': ' + stopErr.message);
        }

        throw err;
      }

      sock = channel;
    }

    function initSocket() {
      try {
        startChannel(true);
      } catch (err) {
        if (isUnsupportedOptionError(err)) {
          debuglog('CAN error frames not supported on ' + node.interface + ', retrying without error frames');

          try {
            startChannel(false);
          } catch (fallbackErr) {
            err = fallbackErr;
          }
        }

        if (!sock) {
          node.error('Error: ' + err.message + node.interface);
          node.status({fill:'red',shape:'dot',text:err.message + '<' + node.interface + '>'});
          debuglog('Error creating socket on ' + node.interface + ': ' + err.message);
          return;
        }
      }

      // Delay status update to ensure socket is fully started and is not reconnecting
      setTimeout(function() {
        if (sock) {
          node.status({fill:'green',shape:'dot',text:'connected <' + node.interface + '>'});
        }
      }, 500);

      debuglog('Socket created and started on ' + node.interface);
    }

    function onRecoverSocket(event) {
      var reason = event && event.reason ? event.reason : 'manual recovery';
      recoverSocket(reason);
    }

    if (this.config.on) {
      this.config.on('recover-socket', onRecoverSocket);
    }

    // Initial connect
    initSocket();

    ///////////////////////////////////////////////////////////////////
    //                          on close
    ///////////////////////////////////////////////////////////////////
    this.on('close', function(removed, done) {
      closing = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      if (node.config && node.config.removeListener) {
        node.config.removeListener('recover-socket', onRecoverSocket);
      }

      stopSocketOnly();
      node.status({fill:'red',shape:'dot',text:'disconnected.'});
      done();
    });
  }
  RED.nodes.registerType('socketcan-out', SocketcanReceiveNode);
}
