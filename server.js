"use strict";
//jshint esversion: 6, -W117, -W097
const http = require('http');
const shoe = require('shoe');
const dnode = require('dnode');
const xtend = require('xtend');
const fuse = require('fuse-bindings');
const E = require('./fuse-errors');
const memoizeasync = require('memoizeasync');
const once = require('once');

function mount(mountPoint, remote, cb) {
    console.log('mounting fuse fs');
    let ops = xtend(remote, {
        displayFolder: true,

        /*
        // -- from mount-url
        mkdir: function (path, mode, cb) { cb(E.EPERM); },
        rmdir: function (path, cb) { cb(E.EPERM); },

        getxattri: function (path, name, buffer, length, offset, cb) { cb(E.EPERM); },
        setxattr: function (path, name, buffer, length, offset, flags, cb) { cb(0); },
        destroy: function (cb) {cb();},
  
        statfs: function (path, cb) {
            cb(0, {
                bsize: 1000000,
                frsize: 1000000,
                blocks: 1000000,
                bfree: 1000000,
                bavail: 1000000,
                files: 1000000,
                ffree: 1000000,
                favail: 1000000,
                fsid: 1000000,
                flag: 1000000,
                namemax: 1000000
            });
        },
        // --
        */
        getattr: /*memoizeasync(*/function(path, cb) {
            remote.getattr(path, (err, stat) => {
                if (err) return cb(err);
                stat.gid = process.getgid();
                stat.uid = process.getuid();
                cb(null, stat);
            });
        }/*, {maxAge: 1000, errors: true})*/, // <-- this might cause trouble?

        read: function(path, fd, buf, len, pos, cb) {
            console.log('read-wrapper', path, fd, len, pos);
            remote.read(fd, len, pos, (err, str) => {
                if (err) return cb(err);
                if (!str) return cb(0);
                buf.write(str);
                return cb(str.length);
            });
        },
        write: function(path, fd, buf, len, pos, cb) {
            console.log('write-wrapper', path, fd, len, pos);
            remote.write(fd, buf.toString(), len, pos, cb);
        }
    });

    // TODO: unmount all mount points
    // TODO: unmount on dnode disconnect
    const onExit = once(function(err) {
        if (err) console.error('onExit', err, err.stack);
        console.log('unmounting ...');
        fuse.unmount(mountPoint, function (err) {
            if (err) console.error('Error while unmounting', err);
            else console.log('done');
            process.exit();
        });
    });
    process.on('SIGINT', onExit);
    process.on('exit', onExit);
    process.on('uncaughtException', onExit);

    // TODO: make up a name for the mount point
    // (we will have a mount point per socket connection)
    // TODO: create the directory for the mount point
    fuse.mount(mountPoint, ops, cb);
    return onExit;
}

module.exports = function(server, options = {}) {
    let {websockPath, api} = options;
    let mountPoint = options.mountPoint || './mnt';
    let sock = shoe((stream) => {
        console.error("incoming websocket connection");
        var d = dnode(api||{});
        let unmount;

        d.on('remote', ( remote) => {
            unmount = mount(mountPoint, remote, (err)=>{
                if (err) console.error(err);
                remote.onMounted(err, mountPoint);
            });
        });

        stream.pipe(d).pipe(stream);

        stream.on('close', ()=>{
            console.error('websocket closed');
            if (unmount) unmount();
        });
    });

    sock.install(server, websockPath || '/domfs');
};
