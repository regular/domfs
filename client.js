//jshint esversion: 6
const shoe = require('shoe');
const split = require('split');

function pathToElement(filepath) {
    if (filepath === '/') return document;
    const selector = filepath.replace('/', ' ');
    const elements = document.querySelectorAll(selector);
    if (elements.length>1) throw new Error(`Selector is ambiguous: ${selector}`);
    return elements[0];
}

function elementsToFilenames(elements) {
    let result = [];
    for(let i=0; i<elements.length; ++i) {
        let el = elements[i];
        result.push(`${((s)=>s.toLowerCase())(el.tagName||'')}:nth-child(${i++})`);
    }
    return result;
}

function ls(filepath) {
    const parent = pathToElement(filepath);
    console.log('parent is', parent);
    const elements = parent.children;
    return elementsToFilenames(elements);
}

let stream = shoe('/domfs');
stream.pipe(split()).on('data', (line)=> {
    console.log(line);
    if (line.slice(0,3) === 'ls ') {
        const filenames = ls(line.slice(3));
        filenames.forEach( (fn)=> stream.write(`${fn}\n`) );
        stream.write('\n');
    }
});
