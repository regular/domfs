//jshint esversion: 6
const shoe = require('shoe');
const http = require('http');
const split = require('split');
const ecstatic = require('ecstatic')(__dirname, {cache: "no-cache"});
 
let server = http.createServer(ecstatic);
server.listen(9999);
 
let sock = shoe((stream) => {
    console.log("incoming websocket connection");
    stream.pipe(split(), {end: false}).on('data', (line)=>{
        console.log(`>> ${line}`);
    });
    stream.write('ls /\n');
});

sock.install(server, '/domfs');
