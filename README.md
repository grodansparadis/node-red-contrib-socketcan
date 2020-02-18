A set of simple nodes for CANBus management on linux machines based on
socketcan npm package(https://www.npmjs.com/package/socketcan,
https://github.com/sebi2k1/node-can)

Current Status:-
- canconfig to configure channel, bitrate
- candump which listens for incoming frames and dumps id,dlc,data for each frame
- cansend to send frame based on specfied id, payload or combination
- Trying to implement similar functionality of socketcan utils like candump,cangen
- Not using many options for cansend such as id range, frame count, duration 
  in between as these are managed from input of additional function nodes

How to Enable Virtual CAN Channel:-

	modprobe vcan

	ip link add dev vcan0 type vcan

	ip link set up vcan0 

	#you can refer https://github.com/linux-can/can-utils/ 
	

TODO/Wish List:-
- Adding Support for extended frames
- Adding more configuration values
- Using better random engine 
- Integration with Kayak
- Better documentation

Test flow:-

	[{"id":"73a93f72.2489","type":"canconfig","z":0,"channel":"vcan0","bitrate":"100000"},{"id":"6e1ca89c.d417b","type":"cansend","z":"21e7592e.177786","config":"73a93f72.2489","canid":"","payload":"","x":570,"y":204,"wires":[]},{"id":"fa2cf7a7.55afe","type":"candump","z":"21e7592e.177786","name":"candump","vconfig":"73a93f72.2489","x":138,"y":104,"wires":[["f2631912.a5ca18"]]},{"id":"233b31e6.9f3d26","type":"inject","z":"21e7592e.177786","name":"","topic":"","payload":"200#abxy","payloadType":"string","repeat":"","crontab":"","once":false,"x":155,"y":203,"wires":[["7dc36d2.f427d14","fc78a840.c0006"]]},{"id":"f2631912.a5ca18","type":"debug","z":"21e7592e.177786","name":"","active":true,"console":"false","complete":"true","x":521,"y":108,"wires":[]},{"id":"3c5d3978.ef7fbe","type":"inject","z":"21e7592e.177786","name":"","topic":"","payload":"abcd","payloadType":"string","repeat":"","crontab":"","once":false,"x":149,"y":381,"wires":[["935e9142.7c2f9"]]},{"id":"935e9142.7c2f9","type":"function","z":"21e7592e.177786","name":"","func":"var msg;\nmsg.canid=129;\nreturn msg;","outputs":1,"noerr":0,"x":324,"y":384,"wires":[["7dc36d2.f427d14"]]},{"id":"1eb03187.f054de","type":"inject","z":"21e7592e.177786","name":"blank","topic":"","payload":"","payloadType":"none","repeat":"","crontab":"","once":false,"x":151,"y":288,"wires":[[]]},{"id":"7dc36d2.f427d14","type":"cansend","z":"21e7592e.177786","config":"73a93f72.2489","canid":"130","payload":"","x":575,"y":345,"wires":[]},{"id":"73fe1cf1.7d1bbc","type":"cansend","z":"21e7592e.177786","config":"73a93f72.2489","canid":"","payload":"hello","x":578,"y":274,"wires":[]},{"id":"fc78a840.c0006","type":"cansend","z":"21e7592e.177786","config":"73a93f72.2489","canid":"130","payload":"hello","x":581,"y":404,"wires":[]}]


