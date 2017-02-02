"use strict";
//jshint esversion: 6, -W117, -W097
const http = require('http');
const shoe = require('shoe');
const ecstatic = require('ecstatic')(__dirname, {cache: "no-cache"});
const dnode = require('dnode');
const xtend = require('xtend');
const fuse = require('fuse-bindings');
 
let server = http.createServer(ecstatic);
server.listen(9999);
 
let sock = shoe((stream) => {
    console.log("incoming websocket connection");
    var d = dnode();
    d.on('remote', (remote) => {
        console.log('dnode remote ready, mounting fuse fs');
        let ops = xtend(remote, {
            read: function(path, fd, buf, len, pos, cb) {
                console.log('read-wrapper', path, fd, len, pos);
                remote.read(fd, len, pos, (err, str) => {
                    if (err) return cb(err);
                    if (!str) return cb(0);
                    buf.write(str);
                    return cb(str.length);
                });
            }
        });

        // TODO: make up a name for the mount point
        // (we will have a mount point per socket connection)
        // TODO: create the directory for the mount point
        fuse.mount('./mnt', ops);

        // TODO: unmount all mount points
        // TODO: unmount on dnode disconnect
        process.on('SIGINT', function () {
            console.log('unmounting ...');
            fuse.unmount('./mnt', function () {
                console.log('done');
                process.exit();
            });
        });

        /*
        remote.open('/body/article:nth-child(4)/.html', (err, fd)=> {
            if (err) return console.log(err);
            remote.read(fd, 200, 0, (err, data)=> {
                if (err) return console.log(err);
                console.log('data:' + data);
                //d.end();
            });
        });
        */
    });
    stream.pipe(d).pipe(stream);

    //stream.write('readdir /body/article:nth-child(4)\n');
    //stream.write('open /body/article:nth-child(4)/div.Klaas/.attrs/class\n');
    //stream.write('read 1 3 1\n'); // fd, length, pos
});

sock.install(server, '/domfs');
