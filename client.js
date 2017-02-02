//jshint esversion: 6, -W083
const shoe = require('shoe');
const split = require('split');
const dnode = require('dnode');

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
    if (filepath === '/') return document.html;
    if (filepath[0] !== '/') throw new Error('filepath must be absolute');
    filepath = filepath.slice(1);

    let segments = filepath.split('/');
    segments.unshift(':root');
    
    const selector = segments.join('>');
    console.log('selector', selector);
    const elements = document.querySelectorAll(selector);
    if (elements.length>1) throw new Error(`Selector is ambiguous: ${selector}`);
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
    // if the last segemtns is .html or .attrs, they get special
    // treatment.
    let specials = specialFiles.split(' ');
    let segments = filepath.split('/');
    let special, extra;

    // the last or secind-to-last segment ,ight be a special
    if (specials.includes(segments[segments.length-1])) {
        special = segments.pop();
        filepath = segments.join('/');
    } else if (specials.includes(segments[segments.length-2])) {
        extra = segments.pop();
        special = segments.pop();
        filepath = segments.join('/');
    }
    return {special, extra, filepath};
}

//
// -- File Operations --
//

function readdir(path, cb) {
    let {special, filepath} = parsePath(path);
    const parent = elementAtPath(filepath);
    let result;
    switch(special) {
        case '.attrs':
            result = getAttributeNames(parent);
            break;
        case '.html':
            return cb(new Error("readdir of .html (it's a file"));
        default:
            // for a normal node, we add the special
            // directory entries.
            result = specialFiles.split(' ');
            result = result.concat(createUniqueNamesForElements(parent.children));
    }
    return cb(JSON.stringify(result));
}

function open(path, cb) {
    let {special, filepath, extra} = parsePath(path);
    const element = elementAtPath(filepath);
    console.log(element, special, extra);
    if (special === '.html') {
        fds[++fd] = {special, element};
        return cb(fd);
    } else if (special == '.attrs' && extra) {
        if (element.getAttribute(extra) !== null) {
            fds[++fd] = {special, element, attrName: extra};
            return cb(fd);
        }
    }
    return cb(-1);
}

function read(fd, length, pos, cb) {
    console.log('read', fd, length, pos);
    if (typeof fds[fd] === 'undefined') {
        console.log('read: file not open');
        return cb(-1);
    }
    let data;
    let {element, special, attrName} = fds[fd];
    if (special == '.attrs') {
        data = element.getAttribute(attrName);
    } else if (special == '.html') {
        data = element.innerHTML;
    }
    console.log('data', data);
    data = data.slice(pos, pos + length);
    return cb(data);
}

const ops = {readdir, open, read};

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
