//jshint esversion: 6, -W060, -W046
const debug = require('debug')('domfs:fops');
const E = require('./fuse-errors');
const Selectors = require('./selectors');

const specialFiles = '.html .attrs';

module.exports = function(document, opts = {}) {
    let prefix = opts.prefix || '';
    let onOpen = opts.onOpen || function(){};
    let onClose = opts.onClose || function(){};

    if (prefix.length) {
        if (prefix[0]!=='/') {
            throw new Error('Prefix must be an absolute path');
        }
        if (prefix[prefix.length-1] === '/') {
            prefix = prefix.substr(0, prefix.length-1);
        }
    }

    let fds = {};
    let fd = 0; // next file descriptor minus one

    let {
        parsePath,
        elementAtPath,
        getAttributeNames,
        createUniqueNamesForElements
    } = Selectors(document);

    function prefixPath(path) {
        path = prefix + path;
        if (path.length>1 && path[path.length-1] == '/') {
            path = path.substring(0, path.length-1);
        }
        return path;
    }

    function processPath(path) {
        path = prefixPath(path);
        let {special, filepath, extra} = parsePath(path);
        let element;
        if (typeof filepath !== 'undefined') { 
            element = elementAtPath(filepath);
        }
        return {special, filepath, extra, element}; 
    }

    function readdir(path, cb) {
        debug('readdir %s', path);
        const {special, filepath, extra, element} = processPath(path);
        if (typeof element == 'undefined') return cb(E.ENOENT);
        let result;
        switch(special) {
            case '.attrs':
                if (extra) return cb(E.ENOTDIR);
                result = getAttributeNames(element);
                break;
            case '.html':
                return cb(E.ENOTDIR);
            default:
                // for a normal node, we add the special
                // directory entries.
                result = specialFiles.split(' ');
                result = result.concat(createUniqueNamesForElements(element.children));
        }
        return cb(0, result);
    }

    function getattr(path, cb) {
        debug(`getattr ${path}`);
        const {special, filepath, extra, element} = processPath(path);
        if (typeof element == 'undefined') return cb(E.ENOENT);

        let isDir = false;
        let size = 0;
        let readonly = false;
        if (special == '.html') {
            isDir = false;
            size = element.innerHTML.length;
        } else if (special == '.attrs') {
            if (extra) {
                let value = element.getAttribute(extra);
                if (value === null) return cb(E.ENOENT);
                size = value.length;
                isDir = false;
            } else {
                size = 0;
                isDir = true;
            }
        } else { // so we are an element
            size = 0;
            isDir = true; 
        }

        cb(0, {
            mtime: Date.now(),
            atime: Date.now(),
            ctime: Date.now(),
            size: isDir ? 100 : size,
            mode: isDir ? (readonly? 0040555 : 0040777): readonly? 0100444 : 0100666,
            uid: 0,
            gid: 0
        });
    }

    function open(path, flags, cb) {
        debug(`open ${path} flags: ${flags}`);
        const {special, filepath, extra, element} = processPath(path);
        if (typeof element == 'undefined') return cb(E.ENOENT);
        if (special == '.html') {
            fds[++fd] = {special, element};
            debug('new fd', fd);
            onOpen(path, flags, fd);
            return cb(0, fd);
        } else if (special == '.attrs') {
            if (!extra) return cb(E.EISDIR);
            if (element.getAttribute(extra) === null) return cb(E.ENOENT);
            
            fds[++fd] = {special, element, attrName: extra};
            debug('new fd', fd);
            onOpen(path, flags, fd);
            return cb(0, fd);
        } else if (special) {
            return cb(E.ENOENT);
        }
        return cb(E.EISDIR);
    }

    function release(path, fd, cb) {
        path = prefixPath(path);
        debug(`release ${path} ${fd}`);
        if (fds[fd]) {
            onClose(fds[fd], fd);
            delete fds[fd];
        }
        return cb(0);
    }

    function read(fd, length, pos, cb) {
        debug('read', fd, length, pos);
        if (typeof fds[fd] === 'undefined') {
            debug('read: file not open');
            return cb(E.EBADF);
        }
        let {element, special, attrName} = fds[fd];
        let data;
        if (special == '.attrs') {
            data = element.getAttribute(attrName);
        } else if (special == '.html') {
            data = element.innerHTML;
        }
        debug('data', data);
        data = data.slice(pos, pos + length);
        return cb(0, data);
    }

    function write(fd, buf, length, pos, cb) {
        function modify(data) {
            // pad data with spaces if necessary
            console.log(1, data);
            let padLen = pos + length - data.length;
            if (padLen>0) {
                data += Array(padLen+1).join(' ');
            }
            console.log(2, data);
            data = data.slice(0, pos) + buf.slice(0, length) + data.slice(pos + length);
            console.log(3, data);
            return data; 
        }
        debug(`write ${fd} ${length} ${pos}`);
        if (typeof fds[fd] === 'undefined') {
            debug('write: file not open');
            return cb(E.EBADF);
        }
        let {element, special, attrName} = fds[fd];
        let data;
        if (special == '.attrs') {
            data = element.getAttribute(attrName);
            data = modify(data);
            element.setAttribute(attrName, data);
        } else if (special == ".html") {
            data = element.innerHTML;
            data = modify(data);
            element.innerHTML = data;
            console.log(4, element.innerHTML);
        } else {
            return cb(E.EPERM); 
        }
        return cb(0, length);
    }

    function create(path, mode, cb) { 
        debug(`creare ${path} mode: ${mode}`);
        const {special, filepath, extra, element} = processPath(path);
        if (typeof element == 'undefined') return cb(E.ENOENT);

        if (special == '.attrs' && extra) {
            if (element.getAttribute(extra) === null) {
                debug('new attr', extra);
                try {
                    element.setAttribute(extra, '');
                } catch(e) {
                    return cb(E.EPERM);
                }
                fds[++fd] = {special, element, attrName: extra};
                debug('new fd', fd);
                return cb(0, fd);
            } else {
                return cb(E.EEXIST);
            }
        } else if (special == '.html') {
            return open(path, 1, cb);
        }
        return cb(E.EPERM);
    }

    /*
    rename: function (src, dst, cb) { cb(E.EPERM); },
    */

    function unlink(path, cb) {
        debug(`unlink ${path}`);
        const {special, filepath, extra, element} = processPath(path);
        if (typeof element == 'undefined') return cb(E.ENOENT);

        if (special == '.attrs' && extra) {
            if (element.getAttribute(extra) !== null) {
                debug('remove attr', extra);
                element.removeAttribute(extra);
                return cb(0);
            } else {
                return cb(E.ENOENT);
            }
        } if (special == ".html") {
            element.innerHTML = '';
            return cb(0);
        }
        return cb(E.ENOENT);
    }

    function flush(path, fd, cb) {
        return cb(0);
    }

    return {
        readdir,
        getattr,
        open,
        read,
        release,
        write,
        create,
        unlink,
        flush
    };
};
