all: bundle.js

bundle.js: client.js
	node_modules/.bin/browserify client.js -o bundle.js

clean:
	rm bundle.js

