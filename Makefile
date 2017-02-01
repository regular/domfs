all: bundle.js

test: test-bundle.js
	open test.html

bundle.js: client.js
	node_modules/.bin/browserify client.js -o bundle.js

test-bundle.js: test.js client.js
	node_modules/.bin/browserify test.js -o test-bundle.js

clean:
	rm bundle.js

