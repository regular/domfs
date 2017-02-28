const debug = require('debug')('domfs:fops');
const E = require('./fuse-errors');
const Selectors = require('./selectors');

const specialFiles = '.html .attrs';

module.exports = function(document, ops = {}) {
    let prefix = ops.prefix || '';
    let onOpenClose = ops.onOpenClose || function(){};

    if (prefix.length) {
        if (prefix[0]!=='/') {
            throw new Error('Prefix must be an absolute path');
        }
        if (prefix[prefix.length-1] === '/') {
            prefix = prefix.substr(0, prefix.length-1);
        }
    }

    let fds = {};
    let fd = 0; // next fd, also: number of successful open operations

    let {
        parsePath,
        elementAtPath,
        getAttributeNames,
        createUniqueNamesForElements
    } = Selectors(document);

    function readdir(path, cb) {
        path = prefix + path;
        if (path.length>1 && path[path.length-1] == '/') {
            path = path.substring(0, path.length-1);
        }
        debug('readdir %s', path);
        let {special, filepath, extra} = parsePath(path);
        const parent = elementAtPath(filepath);
        let result;
        switch(special) {
            case '.attrs':
                if (extra) return cb(E.ENOTDIR);
                result = getAttributeNames(parent);
                break;
            case '.html':
                return cb(E.ENOTDIR);
            default:
                // for a normal node, we add the special
                // directory entries.
                if (typeof parent == 'undefined') return cb(E.ENOENT);
                result = specialFiles.split(' ');
                result = result.concat(createUniqueNamesForElements(parent.children));
        }
        return cb(0, result);
    }

    function getattr(path, cb) {
        debug(`getattr ${path}`);
        if (path.slice(0, 2) === '/.') {
            return cb(E.EPERM);
        }
        let {special, filepath, extra} = parsePath(path);
        const element = elementAtPath(filepath);
        if (typeof element == 'undefined') return cb(E.ENOENT);
        let isDir = false;
        let size = 0;
        let readonly = true;
        if (special == '.html') {
            isDir = false;
            size = element.innerHTML.length;
            readonly = false;
        } else if (special == '.attrs') {
            if (extra) {
                let value = element.getAttribute(extra);
                if (value === null) return cb(E.ENOENT);
                size = value.length;
                isDir = false;
                readonly = false;
            } else {
                size = 0;
                readonly = false;
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
        let {special, filepath, extra} = parsePath(path);
        const element = elementAtPath(filepath);
        if (typeof element == 'undefined') return cb(E.ENOENT);
        if (special == '.html') {
            fds[++fd] = {special, element};
            debug('new fd', fd);
            return cb(0, fd);
        } else if (special == '.attrs' && extra) {
            if (element.getAttribute(extra) !== null) {
                fds[++fd] = {special, element, attrName: extra};
                debug('new fd', fd);
                return cb(0, fd);
            }
        }
        return cb(E.EISDIR);
    }

    function release(path, fd, cb) {
        debug(`release ${path} ${fd}`);
        if (fds[fd]) {
            delete fds[fd];
            releaseOperations++;
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
        debug(element, special, attrName);
        if (special == '.attrs') {
            data = element.getAttribute(attrName);
        } else if (special == '.html') {
            data = element.innerHTML;
        }
        debug('data', data);
        data = data.slice(pos, pos + length);
        return cb(null, data);
    }

    function write(fd, buf, length, pos, cb) {
        function modify(data) {
            // pad data with spaces if necessary
            data += Array(pos + length - data.length + 1).join(' ');
            data = data.slice(0, pos) + buf.slice(0, length) + data.slice(pos + length);
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
        } else {
            return cb(E.EPERM); 
        }
        return cb(length);
    }

    function create(path, mode, cb) { 
        debug(`creare ${path} mode: ${mode}`);
        let {special, filepath, extra} = parsePath(path);
        const element = elementAtPath(filepath);
        if (typeof element == 'undefined') return cb(E.ENOENT);
        if (special == '.attrs' && extra) {
            if (element.getAttribute(extra) === null) {
                debug('new attr', extra);
                element.setAttribute(extra, '');
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
        let {special, filepath, extra} = parsePath(path);
        const element = elementAtPath(filepath);
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
        cb(E.ENOENT);
    }

    function flush(path, fd, cb) {
        return cb(0);
    };

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