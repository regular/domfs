//jshint esversion: 6, -W060
const debug = require('debug')('domfs:selectors');

const specialFiles = '.html .attrs';

module.exports = function(document) {

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
        debug(`getElementAtPath ${filepath}, selector: ${selector}`);
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
        debug(`parsePath special:${special}, extra:${extra}, filepath: ${filepath}`);
        if (special === '.html' && extra) {
            special = undefined;
            extra = undefined;
            filepath = undefined;
        }
        return {special, extra, filepath};
    }

    return {
        parseSimpleSelector,
        findMatches,
        elementAtPath,
        createUniqueNamesForElements,
        getAttributeNames,
        parsePath
    };
};
