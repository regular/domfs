//jshint esversion: 6, -W060
const test = require('tape');
const Impl = require('../lib/selectors');
const Browser = require('zombie');
const debug = require('debug')('test');

test('parsePath', (t)=> {
    let impl = Impl();
    t.deepEqual(impl.parsePath('/.html'),{
        filepath: '/',
        special: '.html',
        extra: undefined
    }, '/.html should be: /, .html, undefined');

    t.deepEqual(impl.parsePath('/.html/extra'), {
        filepath: undefined,
        special: undefined,
        extra: undefined
    }, '/.html/extra should be undefined');

    t.deepEqual(impl.parsePath('/.attrs'),{
        filepath: '/',
        special: '.attrs',
        extra: undefined
    }, '/.attrs should be: /, .attrs, undefined');

    t.deepEqual(impl.parsePath('/'),{
        filepath: '/',
        special: undefined,
        extra: undefined
    }, '/ should be: /, undefined, undefined');

    t.deepEqual(impl.parsePath('/head'),{
        filepath: '/head',
        special: undefined,
        extra: undefined
    }, '/head should be: /head, undefined, undefined');

    t.deepEqual(impl.parsePath('/head/.html'),{
        filepath: '/head',
        special: '.html',
        extra: undefined
    }, '/head/.html should be: /head, .html, undefined');

    t.deepEqual(impl.parsePath('/head/.attrs/id'),{
        filepath: '/head',
        special: '.attrs',
        extra: 'id'
    }, '/head/.attrs/id should be: /head, .attrs, id');

    t.end();
});

test('parseSimpleSelector', (t)=> {
    let impl = Impl();
    t.deepEqual(impl.parseSimpleSelector('div'), {
        tagName: 'div',
        id: undefined,
        classes: undefined,
        pos: undefined,
    }, 'should parse tagName');

    t.deepEqual(impl.parseSimpleSelector('div#myId'), {
        tagName: 'div',
        id: 'myId',
        classes: undefined,
        pos: undefined,
    }, 'should parse tagName and id');

    t.deepEqual(impl.parseSimpleSelector('div.a.b.cee.dee'), {
        tagName: 'div',
        id: undefined,
        classes: 'a b cee dee'.split(' '),
        pos: undefined,
    }, 'should parse tagName and classes');

    t.deepEqual(impl.parseSimpleSelector('div:nth-child(42)'), {
        tagName: 'div',
        id: undefined,
        classes: undefined,
        pos: 42,
    }, 'should parse tagName and pos');

    t.deepEqual(impl.parseSimpleSelector('p#blah.a.b.cee.dee:nth-child(42)'), {
        tagName: 'p',
        id: 'blah',
        classes: 'a b cee dee'.split(' '),
        pos: 42,
    }, 'should parse tagName, id, classes and pos');

    t.end();
});

test('findMatches', (t)=> {
    let impl = Impl();
    t.deepEqual(
        impl.findMatches('div', 'div p div'.split(' ')),
        [0, 2],
        'should find all elements with the same tagName'
    );
    t.deepEqual(
        impl.findMatches('div', 'div p div#theOne'.split(' ')),
        [0, 2],
        'should find all elements with the same tagName, ignoring id'
    );
    t.deepEqual(
        impl.findMatches('div#theOne', 'div p div#theOne'.split(' ')),
        [2],
        'should find all elements with the same tagName and id'
    );

    t.deepEqual(
        impl.findMatches('div.cls', 'div.bla.cls p.cls div#theOne.cls'.split(' ')),
        [0, 2],
        'should find all elements with the same tagName and class'
    );
    t.deepEqual(
        impl.findMatches('div.cls.bla', 'div.bla.cls p.cls div#theOne.cls'.split(' ')),
        [0],
        'sort order of classes shall not matter'
    );
    t.deepEqual(
        impl.findMatches('p.cls.bla', 'p.bla.cls p.cls.bla p#theOne.bla.cls'.split(' ')),
        [0,1,2],
        'id should not be in the way'
    );
    t.deepEqual(
        impl.findMatches('p#notThere', 'p.bla.cls p.cls.bla p#theOne.bla.cls'.split(' ')),
        [],
        'should return empty array, when nothing matches'
    );

    t.end();
});

test('elementAtPath', (t)=> {
    let browser = new Browser();
    browser.open('about:blank');
    let document = browser.window.document;
    let impl = Impl(document);
    document.write(`
        <html>
            <head>
                <title>
                </title>
            </head>
            <body>
            </body>
        </html>
    `);
    t.equal(impl.elementAtPath('/'), document.querySelector('html'), '/ should be the html element');
    t.equal(impl.elementAtPath('/body'), document.getElementsByTagName('body')[0], '/body should be the body element');

    t.equal(impl.elementAtPath('/head'), document.getElementsByTagName('head')[0], '/head should be the head element');

    t.equal(impl.elementAtPath('/head/title'), document.getElementsByTagName('title')[0], '/head/title should be the title element');

    /* jsdom doesn't seem to implemeny :root
     * t.equal(impl.elementAtPath('/title'), undefined, '/title should be undefined');
     */

    t.throws( ()=>{
        impl.elementAtPath('body');
        t.fail('Relative paths should cause an exception');
    }, 'Relative paths should cause an exception');

    t.notOk(impl.elementAtPath('/body/article'), 'Should return falsey for ambigious paths');
    t.notOk(impl.elementAtPath('/body//article'), 'Should return falsey for invalid paths');
    t.notOk(impl.elementAtPath('/body/::bla/article'), 'Should return falsey for invalid paths');
    t.end();
});

test('createUniqueNamesForElements', (t)=> {
    let browser = new Browser();
    browser.open('about:blank');
    let document = browser.window.document;
    let impl = Impl(document);
    document.write(`
        <html>
            <body>
                <article>
                    <div>foo</div>
                    <div>bar</div>
                    <div>baz</div>
                </article>
                <article>
                    <div id='A'></div>
                    <div id='B'></div>
                    <div id='C'></div>
                </article>
                <article>
                    <div id='A'></div>
                    <div id='B'></div>
                    <div id='A'></div>
                </article>
                <article>
                    <div id="unique"></div>
                    <div name="my name"></div>
                    <div class="Klaas"></div>
                </article>
            </body>
        </html>
    `);
    let names = impl.createUniqueNamesForElements;
    let anons = document.querySelector('article').children;
    t.deepEqual(names(anons), [
        'div:nth-child(1)',
        'div:nth-child(2)',
        'div:nth-child(3)',
    ], 'should use nth-child for otherwise indistinguishable siblings');

    let withUniqueIds = document.querySelector('article:nth-child(2)').children;
    t.deepEqual(names(withUniqueIds), [
        'div#A',
        'div#B',
        'div#C',
    ], 'should use ids exclusively if they are unique among siblings');

    let withNonUniqueIds = document.querySelector('article:nth-child(3)').children;
    t.deepEqual(names(withNonUniqueIds), [
        'div#A:nth-child(1)',
        'div#B',
        'div#A:nth-child(3)',
    ], 'should add nth-child, for selectors not unique among siblings');

    let mixed = document.querySelector('article:nth-child(4)').children;
    t.deepEqual(names(mixed), [
        'div#unique',
        'div:nth-child(2)',
        'div.Klaas',
    ], 'should add nth-child, for selectors not unique among siblings');
    t.end();
});
