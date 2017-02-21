//jshint esversion: 6, -W083, -W046
const shoe = require('shoe');
const dnode = require('dnode');
const E = require('./fuse-errors');
const once = require('once');
const unpipe = require('unpipe');
const debug = require('debug')('domfs:client');

const specialFiles = '.html .attrs';

let fds = {};
let fd = 0;

function parseSimpleSelector(selector) {
    let m = selector.match(/(\w+)(#\w+)?((?:\.\w+)*)(:nth-child\((\d+)\))?/);
    if (!m) throw new Error(`Malformed selector: ${selector}`);
    let [_1, tagName, id, classes, _2, pos] = m;
    id = id ? id.slice(1) : undefined;
    classes = classes ? classes.slice(1).split('.') : undefined;
    pos = pos ? parseInt(pos) : undefined;
    return {tagName, id, classes, pos};
}

// returns selectos that are more specific than, or equally specific as,
// the one provided as `needle`
// This is used to check for ambiguity
function findMatches(needle, haystack) {
    let result = [];
    let n  = parseSimpleSelector(needle);
    let i=-1;
    haystack.forEach( (hs)=>{
        i++;
        let h = parseSimpleSelector(hs);

        // if a tag is specified, it must match
        if (n.tagName && n.tagName !== h.tagName) return;

        // if an id is specified, it must match
        if (n.id && n.id !== h.id) return;

        // if a position is specified, it must match
        if (typeof n.pos !== 'undefined' && n.pos != h.pos) return;

        // all specified classes must exist
        let isMatch = true;
        (n.classes || []).forEach( (c)=> {
            //console.log(h);
            if (!h.classes || !h.classes.includes(c)) isMatch = false;
        });

        if (isMatch) result.push(i);
    });
    return result;
}

function elementAtPath(filepath) {
    if (filepath == '/') return document.querySelector('html');
    if (filepath[0] !== '/') throw new Error('filepath must be absolute');
    filepath = filepath.slice(1);

    let segments = filepath.split('/');
    segments.unshift(':root');
    
    const selector = segments.join('>');
    let elements;
    try {
        elements  = document.querySelectorAll(selector);
    } catch(e) {}

    if (elements === undefined) {
        console.error(`nothing matches selector: ${selector}`);
        return undefined;
    }

    if (elements.length>1) {
        console.error(`Selector is ambiguous: ${selector}`);
        return undefined;
    }
    return elements[0];
}

function createUniqueNamesForElements(elements) {
    if (!elements) return [];
    // first we try to create unqiue names using tagName, id and class
    let result = [];
    for(let i=0; i<elements.length; ++i) {
        let el = elements[i];
        let tagName = (el.tagName||'').toLowerCase();

        let selector = tagName;
        let id = el.id;
        if (id) selector += `#${id}`;

        let classes = el.getAttribute('class');
        if (classes) {
            classes = [''].concat(classes.split(' ')).join('.');
            selector += classes;
        }
        result.push(selector);
    }

    // collect indices of non-unique selectors
    let nonUnique = {};
    for(let i=0; i<result.length; ++i) {
        for(let j=0; j<result.length; ++j) {
            if ( (result[i] == result[j]) && (i !== j) ) {
                nonUnique[i] = nonUnique[j] = true;
            }
        }
    }

    // find selectors that are less specific than other selectors
    // already in the set.
    for(let i=0; i<result.length; ++i) {
        let matches = findMatches(result[i], result);
        if (matches.length>1) {
            nonUnique[i] = true;
        } else {
            if (matches.length === 0) throw new Error('What?');
            if (matches[0] !== i) throw new Error('Something is wrong');
        }
    }
    
    // force uniqueness by including
    // the child's position among its peers
    for (let i in nonUnique) {
        i = parseInt(i);
        result[i] = `${result[i]}:nth-child(${i+1})`;
    } 
    return result;
}

function getAttributeNames(el) {
    let len = el.attributes.length;
    let result = [];
    for(let i=0; i<len; ++i) {
        let name = el.attributes[i].name;
        result.push(name);
    }
    return result;
}

function parsePath(filepath) {
    if (filepath[0] !== '/') {
        console.log('parsePath: not an absolute path');
    }
    // if the last segemtns is .html or .attrs, they get special
    // treatment.
    let specials = specialFiles.split(' ');
    let segments = filepath.split('/');
    let special, extra;

    // the last or second-to-last segment might be a special
    if (specials.includes(segments[segments.length-1])) {
        special = segments.pop();
        filepath = segments.join('/');
    } else if (specials.includes(segments[segments.length-2])) {
        extra = segments.pop();
        special = segments.pop();
        filepath = segments.join('/');
    }
    // joining an array with length 1 results in no separator,
    // thus '' must be converted to '/'
    if (filepath === '') filepath ='/';
    return {special, extra, filepath};
}

//
// -- File Operations --
//

function readdir(path, cb) {
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

function release(path, fd, cb) {
    debug(`release ${path} ${fd}`);
    delete fds[fd];
    return cb(0);
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

    cb(null, {
        mtime: Date.now(),
        atime: Date.now(),
        ctime: Date.now(),
        size: isDir ? 100 : size,
        mode: isDir ? (readonly? 0040555 : 0040777): readonly? 0100444 : 0100666,
        uid: 0,
        gid: 0
    });
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

const ops = {
    readdir,
    getattr,
    open,
    read,
    release,
    write,
    create,
    unlink
};

function connect(websocketPath, cb) {
    if (typeof websocketPath == 'function') {
        cb = websocketPath;
        websocketPath = '/domfs';
    }
    cb = once(cb);
    debug('domfs connecting to', websocketPath);
    let stream = shoe(websocketPath);

    let togo = 2;
    let results = {};
    function handler(key) {
        return function(err, result, cb2) {
            debug(key, 'error', err);
            if (err) return cb(err);
            results[key] = result;
            debug('received', key);
            if (--togo === 0) cb(null, results);
            if (cb2) cb2(null);
        };
    }

    ops.onMounted = handler('mountPoint');
    let d = dnode(ops);
    d.on('remote', (remote) => handler('remote')(null, remote) );
    
    stream.on('error', cb);
    stream.pipe(d).pipe(stream);

    function disconnect() {
        unpipe(d);
        unpipe(stream);
        d.end();
        stream.end();
    }
    
    return {disconnect};
}

module.exports = connect;
module.exports.ops = ops;
module.exports.internals = {
    parseSimpleSelector,
    findMatches,
    elementAtPath,
    createUniqueNamesForElements,
    getAttributeNames,
    parsePath
};

