"use strict";
//jshint esversion: 6, -W117, -W097
const http = require('http');
const shoe = require('shoe');
const split = require('split');
const ecstatic = require('ecstatic')(__dirname, {cache: "no-cache"});
const dnode = require('dnode');
 
let server = http.createServer(ecstatic);
server.listen(9999);
 
let sock = shoe((stream) => {
    console.log("incoming websocket connection");
    var d = dnode();
    d.on('remote', (remote) => {
        remote.open('/body/article:nth-child(4)/.html', (fd)=> {
            remote.read(fd, 200, 0, (data)=> {
                console.log('data:' + data);
                d.end();
            });
        });
    });
    stream.pipe(d).pipe(stream);

    //stream.write('readdir /body/article:nth-child(4)\n');
    //stream.write('open /body/article:nth-child(4)/div.Klaas/.attrs/class\n');
    //stream.write('read 1 3 1\n'); // fd, length, pos
});

sock.install(server, '/domfs');
