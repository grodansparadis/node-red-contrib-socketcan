var can = require('socketcan');

var sock = can.createRawChannel("vcan0", true);
sock.start();

// var frame={};
// frame.ext = false;
// frame.rtr = false;
// frame.id = 113;
// frame.dlc = 3;
// frame.data = Buffer.from([1,2,3]);
// sock.send(frame);

var frame_rtr={};
frame_rtr.ext = false;
frame_rtr.rtr = true;
frame_rtr.id = 123;
frame_rtr.dlc = 3;
frame_rtr.data = Buffer.from('123');
sock.send(frame_rtr);

sock.stop();
