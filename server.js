"use strict";
//jshint esversion: 6, -W117, -W097
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
    stream.write('readdir /body/article:nth-child(4)\n');
    stream.write('open /body/article:nth-child(4)/div.Klaas/.attrs/class\n');
    stream.write('read 1 3 1\n'); // fd, length, pos
    stream.write('open /body/article:nth-child(4)/.html\n');
    stream.write('read 2 200 0\n'); // fd, length, pos
});

sock.install(server, '/domfs');
