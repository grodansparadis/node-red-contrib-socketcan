///////////////////////////////////////////////////////////////////////////
// send.js
//
// socketcan output node.
//
// This file is part of the VSCP (https://www.vscp.org)
//
// The MIT License (MIT)
//
// Copyright © 2020-2022 Ake Hedman, Grodans Paradis AB
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

	// Debug:
	// https://nodejs.org/api/util.html
	// export NODE_DEBUG=socketcan-in  for all debug events
	const util = require('util');
	const debuglog = util.debuglog('socketcan-in');
	
	var can = require('socketcan');
	
    function SocketcanSendNode(config) {

        RED.nodes.createNode(this,config);

		this.config = RED.nodes.getNode(config.config);

		if(this.config) {
			this.interface = this.config.interface;
		}
		else {
			return; // Do nothing
			//this.interface="vcan0";
		}

		debuglog("CAN interface = " + this.interface);

		var node = this;

		// Tell the world that we are connecting to the interface
		this.status({fill:"yellow",shape:"dot",text:"connecting... " + "<" + this.interface + ">"});

		var sock;

		try {
			sock = can.createRawChannel("" + this.interface, true);
		} catch(err) {
			// Did not handle this interface
			node.error("Error: " + err.message + " <" + this.interface +">");
			this.status({fill:"red",shape:"dot",text: err.message + " <" + this.interface + ">" });
		}

		if ( sock ) {
			sock.start();

			// Tell the world we are on the job
			this.status({fill:"green",shape:"dot",text:"connected " + "<" + this.interface + ">" });
		
			///////////////////////////////////////////////////////////////////
			//                         on input	
			///////////////////////////////////////////////////////////////////
			
			this.on('input', function (msg, send, done ) {

				debuglog(msg);

				var frame={};
				frame.ext = false;
				frame.rtr = false;

				if ( typeof msg.payload == 'object' ) {

					debuglog("Message format = object");
					frame.ext    = msg.payload.ext || false;
					frame.rtr    = msg.payload.rtr || false;
					frame.id     = msg.payload.canid || 0;
					frame.id    |= (msg.payload.ext ? 1 : 0) << 31;
					frame.dlc    = msg.payload.dlc || 0;
					frame.data = Buffer.from('');
					frame.canfd  = msg.payload.canfd || false;
					
					// remote transmission request does not have any data
					if ( !msg.payload.rtr ) {								
						
						if (!frame.canfd){
							if ( frame.dlc > 8 ) {
								if (done) {
									// Node-RED 1.0 compatible
									done("Invalid CAN frame length " + 
									frame.dlc);
								} 
                else {
									// Node-RED 0.x compatible
									node.error("Invalid CAN frame length " + 
									frame.dlc, msg);
								}							
							}
						}
						else {
							if ( frame.dlc > 64 ) {
								if (done) {
										// Node-RED 1.0 compatible
										done("Invalid CAN FD frame length " + frame.dlc);
								} else {
										// Node-RED 0.x compatible
										node.error("Invalid CAN FD frame length " + frame.dlc, msg);
								}
							}	
						}

            // Added fix for buffer problem proposed by nonujigu
						if ( Array.isArray(msg.payload.data) || Buffer.isBuffer(msg.payload.data) ) {
							frame.data = Buffer.from(msg.payload.data); 
						}
						else if ( typeof msg.payload.data === 'string' ) {
							// Comma separated string
							frame.data = Buffer.from(msg.payload.data.split(","));
						}
            else if (0 == frame.dlc) {
              frame.data = Buffer.from('');
            }
						else {
							// Unknown data format
							if (done) {
								// Node-RED 1.0 compatible
								done("Error: CAN data has unknown format.");
							} 
              else {
								// Node-RED 0.x compatible
								node.error("Error: CAN data has unknown format.", msg);
							}
							
						}
					}
		
				}
				else if ( typeof msg.payload === 'string' ) {

					debuglog("Message format = string");

					// <can_id>#{R|data}
					// for CAN 2.0 frames
					// 
					// <can_id>##<flags>{data}
					// for CAN FD frames
					if( msg.payload && (msg.payload.indexOf("##") != -1 ) ) {
					  debuglog("FD Frame");
            frame.id  = parseInt(msg.payload.split("##")[0],16);
            debuglog("frame.id " + frame.id);
            frame.canfd = true;	
            let data     = msg.payload.split("##")[1];
            debuglog("data " + data);
            frame.data   = Buffer.from(data,"hex");
            frame.dlc    = frame.data.length;
            if ( frame.dlc > 64 ) {
              if (done) {
                // Node-RED 1.0 compatible
                done("Invalid CAN FD frame length " + frame.dlc);
              } 
              else {
                // Node-RED 0.x compatible
                node.error("Invalid CAN FD frame length " + frame.dlc, msg);
              }
            }						 
					}
					else if( msg.payload && (msg.payload.indexOf("#") != -1 ) ) {

            debuglog("CAN Frame");
            frame.canfd = false;
            let id = msg.payload.split("#")[0];
            frame.id  = parseInt(id,16);
            if ( (id.length > 3) || ( frame.id > 0x7ff ) ) {
              frame.id    |= (msg.payload.ext ? 1 : 0) << 31;
              frame.ext = true;
            }
            let data  = msg.payload.split("#")[1];
            debuglog(typeof data,data.indexOf("R"));
            if ( data.indexOf("R") == -1 ) {
              debuglog(data);
              frame.data   = Buffer.from(data,"hex");
              debuglog(frame.data);
              frame.dlc    = frame.data.length;
              if ( frame.dlc > 8 ) {
                if (done) {
                  // Node-RED 1.0 compatible
                  done("Invalid CAN frame length " + frame.dlc);
                } 
                else {
                  // Node-RED 0.x compatible
                  node.error("Invalid CAN frame length " + frame.dlc, msg.payload);
                }	
              }
            }
            else {
              // Remote transmission request  id#R{len}
              debuglog("Remote transmission request ", msg.payload);
              let dlc  = msg.payload.split("#R")[1];
              debuglog("dlc = ", dlc);
              frame.dlc = parseInt(dlc,10);
              frame.canfd = false;
              frame.rtr = true;                  
              frame.data = Buffer.from('');             
            }
					}
					else {

						if (done) {
							// Node-RED 1.0 compatible
							done("Invalid CAN frame");
						} 
            else {
							// Node-RED 0.x compatible
							node.error("Invalid CAN frame", msg);
						}
						
					}
				} 
        else {
					debuglog("Message format = ??????");
				}

        // node socketcan lib need data to send dlc other than zero for frame
        // so we create some data. 
        // Does not matter what the buffer holds as it is not sent
        if (frame.rtr && (frame.dlc > 0) ) {
          frame.data = Buffer.alloc(frame.dlc,0);
        }

				debuglog("canid:" + frame.id + 
							" dlc:"  + frame.dlc + 
							" data:" + Array.prototype.slice.call(frame.data,0) + 
							" ext:"  + frame.ext +
							" rtr:"  + frame.rtr );

				// for CAN_FD we need to fulfill the buffer to have 4 bytes when DLC > 8
				//var datafilling=frame.dlc;

				// Send the CAN frame			 	
				try {
          if (frame.canfd) {
            sock.sendFD(frame);
          }
          else {
            sock.send(frame);
          }
        }
        catch (err) {
          if (done) {
            // Node-RED 1.0 compatible
            done(err);
          } 
          else {
            // Node-RED 0.x compatible
            node.error(err, msg);
          }
        }				
				if (done) {
					done();
				}

			});
		
			///////////////////////////////////////////////////////////////////
			//                     on close	
			///////////////////////////////////////////////////////////////////
			this.on("close", function(removed, done) {
				// Stop operations
				sock.stop();
				
				// Tell the world we had gone down
				this.status({fill:"red",shape:"dot",text:"disconnected."});

				if (removed) {
					// This node has been deleted
				} else {
					// This node is being restarted
				}
			
				done();
			});
		}
  }
  RED.nodes.registerType("socketcan-in",SocketcanSendNode);
}
