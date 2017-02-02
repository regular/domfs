//jshint esversion: 6
const client = require('./client');
const test = require('tape');
const tbe = require('tap-browser-el')();

test('parsePath', (t)=> {
    t.deepEqual(client.parsePath('/.html'),{
        filepath: '/',
        special: '.html',
        extra: undefined
    }, '/.html should be: /, .html, undefined');

    t.deepEqual(client.parsePath('/.attrs'),{
        filepath: '/',
        special: '.attrs',
        extra: undefined
    }, '/.attrs should be: /, .attrs, undefined');

    t.deepEqual(client.parsePath('/'),{
        filepath: '/',
        special: undefined,
        extra: undefined
    }, '/ should be: /, undefined, undefined');

    t.deepEqual(client.parsePath('/head'),{
        filepath: '/head',
        special: undefined,
        extra: undefined
    }, '/head should be: /head, undefined, undefined');

    t.deepEqual(client.parsePath('/head/.html'),{
        filepath: '/head',
        special: '.html',
        extra: undefined
    }, '/head/.html should be: /head, .html, undefined');

    t.deepEqual(client.parsePath('/head/.attrs/id'),{
        filepath: '/head',
        special: '.attrs',
        extra: 'id'
    }, '/head/.attrs/id should be: /head, .attrs, id');

    t.end();
});

test('parseSimpleSelector', (t)=> {
    t.deepEqual(client.parseSimpleSelector('div'), {
        tagName: 'div',
        id: undefined,
        classes: undefined,
        pos: undefined,
    }, 'should parse tagName');

    t.deepEqual(client.parseSimpleSelector('div#myId'), {
        tagName: 'div',
        id: 'myId',
        classes: undefined,
        pos: undefined,
    }, 'should parse tagName and id');

    t.deepEqual(client.parseSimpleSelector('div.a.b.cee.dee'), {
        tagName: 'div',
        id: undefined,
        classes: 'a b cee dee'.split(' '),
        pos: undefined,
    }, 'should parse tagName and classes');

    t.deepEqual(client.parseSimpleSelector('div:nth-child(42)'), {
        tagName: 'div',
        id: undefined,
        classes: undefined,
        pos: 42,
    }, 'should parse tagName and pos');

    t.deepEqual(client.parseSimpleSelector('p#blah.a.b.cee.dee:nth-child(42)'), {
        tagName: 'p',
        id: 'blah',
        classes: 'a b cee dee'.split(' '),
        pos: 42,
    }, 'should parse tagName, id, classes and pos');

    t.end();
});

test('findMatches', (t)=> {
    t.deepEqual(
        client.findMatches('div', 'div p div'.split(' ')),
        [0, 2],
        'should find all elements with the same tagName'
    );
    t.deepEqual(
        client.findMatches('div', 'div p div#theOne'.split(' ')),
        [0, 2],
        'should find all elements with the same tagName, ignoring id'
    );
    t.deepEqual(
        client.findMatches('div#theOne', 'div p div#theOne'.split(' ')),
        [2],
        'should find all elements with the same tagName and id'
    );

    t.deepEqual(
        client.findMatches('div.cls', 'div.bla.cls p.cls div#theOne.cls'.split(' ')),
        [0, 2],
        'should find all elements with the same tagName and class'
    );
    t.deepEqual(
        client.findMatches('div.cls.bla', 'div.bla.cls p.cls div#theOne.cls'.split(' ')),
        [0],
        'sort order of classes shall not matter'
    );
    t.deepEqual(
        client.findMatches('p.cls.bla', 'p.bla.cls p.cls.bla p#theOne.bla.cls'.split(' ')),
        [0,1,2],
        'id should not be in the way'
    );
    t.deepEqual(
        client.findMatches('p#notThere', 'p.bla.cls p.cls.bla p#theOne.bla.cls'.split(' ')),
        [],
        'should return empty array, when nothing matches'
    );

    t.end();
});

test('elementAtPath', (t)=> {
    t.equal(client.elementAtPath('/'), document.querySelector('html'), '/ should be the html element');
    t.equal(client.elementAtPath('/body'), document.getElementsByTagName('body')[0], '/body should be the body element');

    t.equal(client.elementAtPath('/head'), document.getElementsByTagName('head')[0], '/head should be the head element');

    t.equal(client.elementAtPath('/head/title'), document.getElementsByTagName('title')[0], '/head/title should be the title element');

    t.equal(client.elementAtPath('/title'), undefined, '/title should be undefined');

    try {
        client.elementAtPath('body');
        t.fail('Relative paths should cause an exception');
    } catch(e) {
        t.pass('Relative paths should cause an exception');
    }

    try {
        client.elementAtPath('/body/article');
        t.fail('Ambiguous paths should cause an exception');
    } catch(e) {
        t.pass('Ambiguous paths should cause an exception');
    }
    t.end();
});

test('createUniqueNamesForElements', (t)=> {
    let names = client.createUniqueNamesForElements;
    let anons = document.querySelector('article:first-child').children;

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
