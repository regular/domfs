//jshint esversion: 6, -W060, -W046
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

test('getattr', (t)=>{
    let browser = new Browser();
    browser.open('about:blank');
    let document = browser.window.document;
    document.write(`
        <html lang="en" id="blah">
            <head>
                <title lang="de">Hello World</title>
            </head>
        </html>
    `);
    t.test('root', (t)=>{
        Fops(document).getattr('/', (err, result) => {
            t.equal(err, 0, 'Error should be 0');
            t.equal(typeof result.mtime, 'number', "mtime should be a number");
            t.equal(typeof result.atime, 'number', "atime should be a number");
            t.equal(typeof result.ctime, 'number', "ctime should be a number");
            t.equal(result.mode, 0040777, "mode should be correct");
            t.end();
        });
    });
    t.test('an element: /head', (t)=>{
        Fops(document).getattr('/head', (err, result) => {
            t.equal(err, 0, 'Error should be 0');
            t.equal(typeof result.mtime, 'number', "mtime should be a number");
            t.equal(typeof result.atime, 'number', "atime should be a number");
            t.equal(typeof result.ctime, 'number', "ctime should be a number");
            t.equal(result.mode, 0040777, "mode should be correct");
            t.end();
        });
    });
    t.test('Attributes of root: /.attrs', (t)=>{
        Fops(document).getattr('/.attrs', (err, result) => {
            t.equal(err, 0, 'Error should be 0');
            t.equal(typeof result.mtime, 'number', "mtime should be a number");
            t.equal(typeof result.atime, 'number', "atime should be a number");
            t.equal(typeof result.ctime, 'number', "ctime should be a number");
            t.equal(result.mode, 0040777, "mode should be correct");
            t.end();
        });
    });
    t.test('Attributes of nested element: /head/title/.attrs', (t)=>{
        Fops(document).getattr('/head/title/.attrs', (err, result) => {
            t.equal(err, 0, 'Error should be 0');
            t.equal(typeof result.mtime, 'number', "mtime should be a number");
            t.equal(typeof result.atime, 'number', "atime should be a number");
            t.equal(typeof result.ctime, 'number', "ctime should be a number");
            t.equal(result.mode, 0040777, "mode should be correct");
            t.end();
        });
    });
    t.test('Existing attribute value /head/title/.attrs/lang', (t)=>{
        Fops(document).getattr('/head/title/.attrs/lang', (err, result) => {
            t.equal(err, 0, 'Error should be 0');
            t.equal(typeof result.mtime, 'number', "mtime should be a number");
            t.equal(typeof result.atime, 'number', "atime should be a number");
            t.equal(typeof result.ctime, 'number', "ctime should be a number");
            t.equal(result.size, 2, 'Size should be correct');
            t.equal(result.mode, 0100666, "mode should be correct");
            t.end();
        });
    });
    t.test('Non-existing attribute value /head/title/.attrs/foo', (t)=>{
        Fops(document).getattr('/head/title/.attrs/foo', (err, result) => {
            t.equal(err, E.ENOENT, 'Error should be ENOENT');
            t.equal(result, undefined, 'Result should be undefined');
            t.end();
        });
    });
    t.test('html of existing element: /head/title/.html', (t)=>{
        Fops(document).getattr('/head/title/.html', (err, result) => {
            t.equal(err, 0, 'Error should be 0');
            t.equal(typeof result.mtime, 'number', "mtime should be a number");
            t.equal(typeof result.atime, 'number', "atime should be a number");
            t.equal(typeof result.ctime, 'number', "ctime should be a number");
            t.equal(result.size, 11, 'Size should be correct');
            t.equal(result.mode, 0100666, "mode should be correct");
            t.end();
        });
    });
    t.test('html of non-existing element: /head/foo/.html', (t)=>{
        Fops(document).getattr('/head/foo/.html', (err, result) => {
            t.equal(err, E.ENOENT, 'Error should be ENOENT');
            t.equal(result, undefined, 'Result should be undefined');
            t.end();
        });
    });
    t.test('bogus special file of existing element: /head/.foo', (t)=>{
        Fops(document).getattr('/head/.foo', (err, result) => {
            t.equal(err, E.ENOENT, 'Error should be ENOENT');
            t.equal(result, undefined, 'Result should be undefined');
            t.end();
        });
    });
    t.test('bogus special file of non-existing element: /head/foo/.bar', (t)=>{
        Fops(document).getattr('/head/foo/.bar', (err, result) => {
            t.equal(err, E.ENOENT, 'Error should be ENOENT');
            t.equal(result, undefined, 'Result should be undefined');
            t.end();
        });
    });
    t.test('invalid path: /head/:://', (t)=>{
        Fops(document).getattr('/head/:://', (err, result) => {
            t.equal(err, E.ENOENT, 'Error should be ENOENT');
            t.equal(result, undefined, 'Result should be undefined');
            t.end();
        });
    });
});

test('open', (t)=>{
    let browser = new Browser();
    browser.open('about:blank');
    let document = browser.window.document;
    document.write(`
        <html lang="en" id="blah">
            <head>
                <title lang="de">Hello World</title>
            </head>
        </html>
    `);
    let openCount = 0;
    function onOpen() {openCount++;}
    const flags = 0;

    t.test('open root', (t)=>{
        Fops(document, {onOpen}).open('/', flags, (err, result) => {
            t.equal(openCount, 0, 'Should not have called onOpen');
            t.equal(err, E.EISDIR, 'Should return error EISDIR');
            t.end();
        });
    });
    t.test('attributes of root', (t)=>{
        Fops(document, {onOpen}).open('/.attrs', flags, (err, result) => {
            t.equal(openCount, 0, 'Should not have called onOpen');
            t.equal(err, E.EISDIR, 'Should return error EISDIR');
            t.end();
        });
    });
    t.test('html of root', (t)=>{
        Fops(document, {onOpen}).open('/.html', flags, (err, result) => {
            t.equal(openCount, 1, 'Should have called onOpen');
            t.equal(result, 1, 'Should be fd==1');
            t.equal(err, 0, 'Should return err 0');
            t.end();
        });
    });
    t.test('attribute value of root', (t)=>{
        Fops(document, {onOpen}).open('/.attrs/lang', flags, (err, result) => {
            t.equal(openCount, 2, 'Should have called onOpen');
            t.equal(result, 1, 'Should be fd==1');
            t.equal(err, 0, 'Should return err 0');
            t.end();
        });
    });
    t.test('non-existing attribute value of root', (t)=>{
        Fops(document, {onOpen}).open('/.attrs/foo', flags, (err, result) => {
            t.equal(openCount, 2, 'Should not have called onOpen');
            t.equal(err, E.ENOENT, 'Should return err ENOENT');
            t.end();
        });
    });
    t.test('html of non-existing element', (t)=>{
        Fops(document, {onOpen}).open('/foo/.html', flags, (err, result) => {
            t.equal(openCount, 2, 'Should not have called onOpen');
            t.equal(err, E.ENOENT, 'Should return err ENOENT');
            t.end();
        });
    });
    t.test('attribute value of non-existing element', (t)=>{
        Fops(document, {onOpen}).open('/foo/.attrs/foo', flags, (err, result) => {
            t.equal(openCount, 2, 'Should not have called onOpen');
            t.equal(err, E.ENOENT, 'Should return err ENOENT');
            t.end();
        });
    });
    t.test('invalid path', (t)=>{
        Fops(document, {onOpen}).open('/://foo', flags, (err, result) => {
            t.equal(openCount, 2, 'Should not have called onOpen');
            t.equal(err, E.ENOENT, 'Should return err ENOENT');
            t.end();
        });
    });
});


test('read', (t)=>{
    let browser = new Browser();
    browser.open('about:blank');
    let document = browser.window.document;
    document.write(`
        <html lang="en" id="blah">
            <head>
                <title lang="de">Hello World</title>
            </head>
        </html>
    `);

    t.test('non-open file', (t)=>{
        Fops(document).read(0, 0, 0, (err, result) => {
            t.equal(err, E.EBADF, 'Should return error EBADF');
            t.end();
        });
    });
    let {open, read} =  Fops(document);
    const openFlags = 0;

    t.test('root attributes value, single bytes', (t)=>{
        open('/.attrs/lang', openFlags, (err, fd) => {
            read(fd, 2, 0, (err, data) => {
                t.equal(err, 0, 'Should not error');
                t.equal(data, 'en', 'Should read correct data');
                read(fd, 1, 0, (err, data) => {
                    t.equal(err, 0, 'Should not error');
                    t.equal(data, 'e', 'Should read correct data');
                    read(fd, 1, 1, (err, data) => {
                        t.equal(err, 0, 'Should not error');
                        t.equal(data, 'n', 'Should read correct data');
                        t.end();
                    });
                });
            });
        });
    });
    t.test('root attributes value, entire file', (t)=>{
        open('/.attrs/id', openFlags, (err, fd) => {
            read(fd, 4, 0, (err, data) => {
                t.equal(err, 0, 'Should not error');
                t.equal(data, 'blah', 'Should read correct data');
                t.end();
            });
        });
    });

    t.test('html in pieces', (t)=>{
        open('/head/title/.html', openFlags, (err, fd) => {
            read(fd, 5, 0, (err, data) => {
                t.equal(err, 0, 'Should not error');
                t.equal(data, 'Hello', 'Should read correct data');
                read(fd, 5, 6, (err, data) => {
                    t.equal(err, 0, 'Should not error');
                    t.equal(data, 'World', 'Should read correct data');
                    read(fd, 11, 0, (err, data) => {
                        t.equal(err, 0, 'Should not error');
                        t.equal(data, 'Hello World', 'Should read correct data');
                        read(fd, 100, 0, (err, data) => {
                            t.equal(err, 0, 'Should not error');
                            t.equal(data, 'Hello World', 'Should provide all data if tried to read past the end.');
                            t.end();
                        });
                    });
                });
            });
        });
    });
});


test('write', (t)=>{
    let browser = new Browser();
    browser.open('about:blank');
    let document = browser.window.document;
    document.write(`
        <html lang="en" id="blah">
            <head><title lang="de">Hello World</title></head>
        </html>
    `);

    t.test('non-open file', (t)=>{
        Fops(document).write(0, 'blah', 0, 0, (err, result) => {
            t.equal(err, E.EBADF, 'Should return error EBADF');
            t.end();
        });
    });
    let {open, write} =  Fops(document);
    const openFlags = 0;

    t.test('root attributes value, single bytes', (t)=>{
        open('/.attrs/lang', openFlags, (err, fd) => {
            write(fd, 'x', 1, 0, (err, result) => {
                t.equal(err, 0, 'Should not error');
                t.equal(result, 1, 'Result should be number of bytes written');
                t.equal(document.querySelector('html').getAttribute('lang'), 'xn', 'Should alter first char of attribute value');
                write(fd, 'y', 1, 1, (err) => {
                    t.equal(err, 0, 'Should not error');
                    t.equal(result, 1, 'Result should be number of bytes written');
                    t.equal(document.querySelector('html').getAttribute('lang'), 'xy', 'Should alter 2nd char of attribute value');

                    write(fd, 'z', 1, 2, (err, data) => {
                        t.equal(err, 0, 'Should not error');
                        t.equal(result, 1, 'Result should be number of bytes written');
                        t.equal(document.querySelector('html').getAttribute('lang'), 'xyz', 'Should append char to attribute value');
                        t.end();
                    });
                });
            });
        });
    });

    t.test('head html, overwrite with longer ', (t)=>{
        open('/head/.html', openFlags, (err, fd) => {
            let data = 'The quick brown fox jumps over the lazy dog.';
            write(fd, data, data.length, 0, (err, result) => {
                t.equal(err, 0, 'Should not error');
                t.equal(result, data.length, 'Result should be number of bytes written');
                t.equal(document.querySelector('head').innerHTML, data, 'Should have altered innerHTML');
                write(fd, '  A', 3, 0, (err, result) => {
                    t.equal(err, 0, 'Should not error');
                    t.equal(result, 3, 'Result should be number of bytes written');
                    t.equal(document.querySelector('head').innerHTML, '  A quick brown fox jumps over the lazy dog.', 'Should have altered innerHTML');
                    t.end();
                });
            });
        });
    });

});


