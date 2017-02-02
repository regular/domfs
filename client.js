//jshint esversion: 6, -W083
const shoe = require('shoe');
const dnode = require('dnode');
const E = require('./fuse-errors');

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

// returns selectos that are more or equal specific than
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
            console.log(h);
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
    console.log('selector', selector);
    let elements;
    try {
        elements  = document.querySelectorAll(selector);
    } catch(e) {}

    if (elements === undefined) {
        console.log(`nothing matches selector: ${selector}`);
        return undefined;
    }

    if (elements.length>1) {
        console.log(`Selector is ambiguous: ${selector}`);
        return undefined;
    }
    return elements[0];
}

function createUniqueNamesForElements(elements) {
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
    
    // force unqiqueness by including
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
    console.log('readdir', path);
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
    return cb(null, result);
}

function release(path, fd, cb) {
    console.log('release', path, fd);
    delete fds[fd];
    return cb(null);
}

function getattr(path, cb) {
    console.log(`getattr ${path}`);
    let {special, filepath, extra} = parsePath(path);
    console.log(special, filepath, extra);
    const element = elementAtPath(filepath);
    console.log(element);
    if (typeof element == 'undefined') return cb(E.ENOENT);
    let isDir = false;
    let size = 0;
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
            size = 100; //TODO
            isDir = true; 
        }
    } else { // so we are an element
        size = 100; //TODO
        isDir = true; 
    }

    cb(null, {
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        size,
        mode: isDir ? 16877 : 33188, // TODO
        uid: 1000,
        gid: 1000
    });
}

function open(path, flags, cb) {
    console.log('open', path, flags);
    let {special, filepath, extra} = parsePath(path);
    console.log(special, filepath, extra);
    const element = elementAtPath(filepath);
    console.log(element);
    if (typeof element == 'undefined') return cb(E.ENOENT);
    if (special === '.html') {
        fds[++fd] = {special, element};
        console.log('new fd', fd);
        return cb(null, fd);
    } else if (special == '.attrs' && extra) {
        if (element.getAttribute(extra) !== null) {
            fds[++fd] = {special, element, attrName: extra};
            console.log('new fd', fd);
            return cb(null, fd);
        }
    }
    return cb(E.EISDIR);
}

function read(fd, length, pos, cb) {
    console.log('read', fd, length, pos);
    if (typeof fds[fd] === 'undefined') {
        console.log('read: file not open');
        return cb(E.EBADF);
    }
    let data;
    let {element, special, attrName} = fds[fd];
    console.log(element, special, attrName);
    if (special == '.attrs') {
        data = element.getAttribute(attrName);
    } else if (special == '.html') {
        data = element.innerHTML;
    }
    console.log('data', data);
    data = data.slice(pos, pos + length);
    return cb(null, data);
}

const ops = {readdir, getattr, open, read, release};

function run() {
    let stream = shoe('/domfs');
    stream.pipe(dnode(ops)).pipe(stream);
}

module.exports = {
    parseSimpleSelector,
    findMatches,
    elementAtPath,
    createUniqueNamesForElements,
    getAttributeNames,
    parsePath,
    readdir,
    run
};

run();
