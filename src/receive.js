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

    function onStopped() {
      sock = null;

      debuglog('Socket stopped, reconnecting');
      node.status({fill:'yellow',shape:'dot',text:'reconnecting...<' + node.interface + '>'});

      setTimeout(function() {
        initSocket();
      }, reconnectInterval);
    }

    function initSocket() {
      try {
        sock = can.createRawChannel('' + node.interface, {timestamps: true, receive_error_frames: true});
        sock.addListener('onMessage', onMessage);
        sock.addListener('onStopped', onStopped);
        sock.start();

        // Delay status update to ensure socket is fully started and is not reconnecting
        setTimeout(function() {
          if (sock) {
            node.status({fill:'green',shape:'dot',text:'connected <' + node.interface + '>'});
          }
        }, 500);
        
        debuglog('Socket created and started on ' + node.interface);
      } catch (err) {
        node.error('Error: ' + err.message + node.interface);
        node.status({fill:'red',shape:'dot',text:err.message + '<' + node.interface + '>'});
        debuglog('Error creating socket on ' + node.interface + ': ' + err.message);
        return;
      }
    }

    // Initial connect
    initSocket();

    ///////////////////////////////////////////////////////////////////
    //                          on close
    ///////////////////////////////////////////////////////////////////
    this.on('close', function(removed, done) {
      if (sock) {
        sock.stop();
        sock = null;
      }
      node.status({fill:'red',shape:'dot',text:'disconnected.'});
      done();
    });
  }
  RED.nodes.registerType('socketcan-out', SocketcanReceiveNode);
}
