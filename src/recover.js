///////////////////////////////////////////////////////////////////////////
// recover.js
//
// socketcan manual recovery node.
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
  "use strict";

  function SocketcanRecoverNode(config) {
    RED.nodes.createNode(this, config);

    this.name = config.name;
    this.config = RED.nodes.getNode(config.config);

    if (!this.config) {
      return;
    }

    var node = this;

    this.status({fill:"green",shape:"dot",text:"ready <" + this.config.interface + ">"});

    this.on("input", function(msg, send, done) {
      send = send || function() {
        node.send.apply(node, arguments);
      };

      var reason = "manual recovery";

      if (msg.reason) {
        reason = msg.reason;
      } else if (msg.payload && typeof msg.payload === "object" && msg.payload.reason) {
        reason = msg.payload.reason;
      } else if (typeof msg.payload === "string" && msg.payload.length) {
        reason = msg.payload;
      }

      node.config.recoverSockets(reason);

      msg.socketcan = {
        interface: node.config.interface,
        recoveryRequested: true,
        reason: reason,
        timestamp: Date.now()
      };

      node.status({fill:"green",shape:"dot",text:"requested <" + node.config.interface + ">"});
      send(msg);

      if (done) {
        done();
      }
    });

    this.on("close", function(removed, done) {
      node.status({});
      done();
    });
  }

  RED.nodes.registerType("socketcan-recover", SocketcanRecoverNode);
};
