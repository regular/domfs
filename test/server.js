//jshint esversion:6
const http = require('http');
const browserify = require('browserify');
const Browser = require('zombie');
const fs = require('fs');
const debug = require('debug')('test-server');

const domfs = require('../server');

let server = http.createServer( (req, res) => {
    debug(`${req.method} ${req.url}`);
    if (req.url === '/test.js') {
        res.writeHead(200, {'content-type': 'application/javascript'});
        let b = browserify(__dirname + '/test.js');
        b.bundle().pipe(res);
    } else if (req.url == '/') {
        res.writeHead(200, {'content-type': 'text/html'});
        res.end(`<html>
            <body>
                <script>
                    localStorage.debug = "${process.env.DEBUG || ''}";
                </script>
                <script src='test.js'></script>
            </body>
        </html>`);
    } else {
        res.writeHead(404);
        res.end();
    }
});

domfs(server, {api: fs, mountPoint: __dirname + '/mnt'});

server.listen( function (err) {
    let server = this;
    if (err) {
        console.error(err);
        process.exit(1);
    }
    let url = `http://localhost:${server.address().port}/`;
    debug(`Server running on ${url}`);
    let browser = new Browser();
    browser.visit(url, (err)=>{
        debug('Zombie is done visiting');
        if (err) throw err;
        try {
            browser.assert.evaluate('allTestsPassed', true, 'all tests passed');
        } catch(e) {
            debug('Some tests failed or did not run.');
            process.exitCode = 1;
        }
       server.close();
       browser.tabs.closeAll();
    });
});


