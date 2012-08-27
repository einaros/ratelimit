# ratelimit

Simple rate limiting for node.js streams, capable of capping both read and write streams.

# Install

`npm install ratelimit`

# Usage

## Basic

    var ratelimit = require('ratelimit');
    ratelimit(stream, bytesPerSecond);

## To clear the limit

    var ratelimit = require('ratelimit');
    var limited = ratelimit(stream, bytesPerSecond);
    // ...
    limited.end();

## Write limit

    var ratelimit = require('ratelimit');
    var limited = ratelimit(stream, bytesPerSecond);
    limited.write('some data', 'utf8');
    limited.write(new Buffer([1, 2, 3]));

## HTTP (see examples/http for a more elaborate example)

    var http = require('http')
      , ratelimit = require('ratelimit');

    http.get('http://someplace.com/path/file.zip', function(res) {
      ratelimit(res, 65 * 1024);
      res.on('data', function(data) {
        // do whatever with data
      });
    });

## Other examples

See the tests for now.

# Todo

- Test writable file streams.
- Examples (e.g. HTTP).
