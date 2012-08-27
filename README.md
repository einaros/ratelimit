# ratelimit

Simple rate limiting for node.js streams, capable of capping both read and write streams.

# Install

`npm install ratelimit`

# Usage

## http (see examples/http for a more elaborate example)

    var http = require('http')
      , ratelimit = require('../../');

    http.get('http://someplace.com/path/file.zip', function(res) {
      var limit = ratelimit(res, 65 * 1024);
      res.on('data', function(data) {
        // do whatever with data
      });
    });

## other examples

See the tests for now.

# Todo

- Test writable file streams.
- Examples (e.g. HTTP).
