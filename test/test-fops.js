//jshint esversion: 6
const test = require('tape');
const Browser = require('zombie');
const debug = require('debug')('test');
const E = require('../lib/fuse-errors');
const Fops = require('../lib/fops');

test('Fops', (t)=>{
    t.throws(()=>{
        Fops(document, {prefix: 'head'});
    }, 'Should throw, if prefix is not an aboslute path');
    t.end();
});

test('readdir', (t)=> {
    let browser = new Browser();
    browser.open('about:blank');
    let document = browser.window.document;
    document.write(`
        <html lang="en" id="blah">
            <head>
                <title>
                </title>
            </head>
            <body>
            </body>
        </html>
    `);
    t.plan(12);
    Fops(document).readdir('/', (err, result)=>{
        t.equal(err, 0, 'Should not error');
        t.deepEqual(
            result,
            ['.html', '.attrs', 'head', 'body'],
            'readdir("/") should return [.html, .attrs, head, body]'
        );
    });
    Fops(document).readdir('/.attrs', (err, result)=>{
        t.equal(err, 0, 'Should not error');
        t.deepEqual(
            result,
            ['lang', 'id'],
            'readdir("/.attrs") should list attributes of the html element'
        );
    });
    Fops(document).readdir('/://', (err, result)=>{
        t.equal(err, E.ENOENT, 'Should return ENOENT for invalid paths');
        t.notOk(result, 'result should be undefined for invalid paths');
    });
    Fops(document).readdir('/.attrs/id', (err, result)=>{
        t.equal(err, E.ENOTDIR, 'Should return ENONOTDIR for /.attrs/id');
        t.notOk(result, 'result should be undefined for /.attrs/id');
    });
    Fops(document).readdir('/.html', (err, result)=>{
        t.equal(err, E.ENOTDIR, 'Should return ENONOTDIR for /.html');
        t.notOk(result, 'result should be undefined for /.html');
    });
    Fops(document, {
        prefix: '/head'
    }).readdir('/', (err, result)=>{
        t.equal(err, 0, 'Should not error');
        t.deepEqual(
            result,
            ['.html', '.attrs', 'title'],
            'readdir("/") should return [.html, .attrs, title], if prefix is /head'
        );
    });
});
