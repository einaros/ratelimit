var ratelimit = require('../lib/ratelimit')
  , assert = require('assert')
  , net = require('net')
  , fs = require('fs')
  , stream = require('stream');

function generateRandomData(size) {
  var buffer = new Buffer(size);
  for (var i = 0; i < size; ++i) {
    buffer[i] = ~~(Math.random() * 127);
  }
  return buffer;
}

function roundPrec(num, prec) {
  var mul = Math.pow(10, prec);
  return Math.round(num * mul) / mul;
}

function humanSize(bytes) {
  if (bytes >= 1048576) return roundPrec(bytes / 1048576, 2) + ' MB';
  if (bytes >= 1024) return roundPrec(bytes / 1024, 2) + ' kB';
  return roundPrec(bytes, 2) + ' B';
}

function generateRandomData(size) {
  var buffer = new Buffer(size);
  for (var i = 0; i < size; ++i) {
    buffer[i] = ~~(Math.random() * 127);
  }
  return buffer;
}

describe('Rate limiting', function() {
  describe('of readable file streams', function() {
    [0.5, 1, 2, 10].forEach(function(speed) {
      var targetBytesPersSec = speed * 1048576;
      var duration = 3000;

      it('limits the rate to ' + speed + 'MB/sec within 95% accuracy', function(done) {
        var stream = fs.createReadStream('/dev/urandom');
        setTimeout(function() { stream.destroy(); }, duration);
        var r = ratelimit(stream, targetBytesPersSec);
        var startTime;
        var dataLength = 0;
        stream.on('data', function(data) {
          var now = Date.now();
          dataLength += data.length;
          if (!startTime) startTime = now;
        });
        stream.on('close', function() {
          var endTime = Date.now();
          var bytesPerSec = dataLength / (endTime - startTime) * 1000;
          var deviance = Math.abs(targetBytesPersSec - bytesPerSec) / targetBytesPersSec;
          // console.log('Target: ' + speed + ' MB/sec');
          // console.log('Actual: ' + roundPrec(bytesPerSec / 1048576, 2) + ' MB/sec');
          // console.log('Deviance: ' + roundPrec(deviance * 100, 2) + '%');
          assert.ok(deviance < 0.05);
          done();
        });
      });
    });

    it('can be stopped', function(done) {
      var stream = fs.createReadStream('/dev/urandom');
      setTimeout(function() { stream.destroy(); }, 1500);
      var r = ratelimit(stream, 512*1024);
      r.end();
      var startTime;
      var dataLength = 0;
      stream.on('data', function(data) {
        var now = Date.now();
        dataLength += data.length;
        if (!startTime) startTime = now;
      });
      stream.on('close', function() {
        var endTime = Date.now();
        var bytesPerSec = dataLength / (endTime - startTime) * 1000;
        var deviance = Math.abs(1048576 - bytesPerSec) / 1048576;
        assert.ok(deviance > 5);
        done();
      });
    });
  });

  describe('of readable network streams', function() {
    var randomData = generateRandomData(1048576);

    [0.1, 1, 2, 10, 100, 500].forEach(function(speed) {
      var targetBytesPersSec = speed * 1048576;
      var duration = 3000;

      it('limits the rate to ' + speed + 'MB/sec within 95% accuracy', function(done) {
        var stop = false;
        setTimeout(function() { stop = true; }, duration);
        var server = net.createServer(function(c) {
          c.write(randomData);
          c.on('drain', function() {
            if (!stop) c.write(randomData);
            else c.end();
          });
        });
        server.listen(8765, function() {
          var client = net.connect({port: 8765});
          var r = ratelimit(client, targetBytesPersSec);
          var startTime;
          var dataLength = 0;
          client.on('data', function(data) {
            var now = Date.now();
            dataLength += data.length;
            if (!startTime) startTime = now;
          });
          client.on('end', function() {
            var endTime = Date.now();
            var bytesPerSec = dataLength / (endTime - startTime) * 1000;
            var deviance = Math.abs(targetBytesPersSec - bytesPerSec) / targetBytesPersSec;
            // console.log('Target: ' + speed + ' MB/sec');
            // console.log('Actual: ' + roundPrec(bytesPerSec / 1048576, 2) + ' MB/sec');
            // console.log('Deviance: ' + roundPrec(deviance * 100, 2) + '%');
            assert.ok(deviance < 0.05);
            server.close();
            done();
          });
        });
      });
    });

    it('can be stopped', function(done) {
      var stop = false;
      setTimeout(function() { stop = true; }, 1500);
      var server = net.createServer(function(c) {
        c.write(randomData);
        c.on('drain', function() {
          if (!stop) c.write(randomData);
          else c.end();
        });
      });
      server.listen(8765, function() {
        var client = net.connect({port: 8765});
        var r = ratelimit(client, 1048576);
        r.end();
        var startTime;
        var dataLength = 0;
        client.on('data', function(data) {
          var now = Date.now();
          dataLength += data.length;
          if (!startTime) startTime = now;
        });
        client.on('end', function() {
          var endTime = Date.now();
          var bytesPerSec = dataLength / (endTime - startTime) * 1000;
          var deviance = Math.abs(1048576 - bytesPerSec) / 1048576;
          assert.ok(deviance > 10);
          server.close();
          done();
        });
      });
    });
  });

  describe('writable streams', function() {
    var randomData = generateRandomData(1048576);

    [1, 2, 10, 100, 500].forEach(function(speed) {
      var targetBytesPersSec = speed * 1048576;
      var duration = 3000;

      it('limits the rate to ' + speed + 'MB/sec within 95% accuracy', function(done) {
        var stop = false;
        setTimeout(function() { stop = true; }, duration);
        var server = net.createServer(function(c) {
          var r = ratelimit(c, targetBytesPersSec);
          r.write(randomData);
          c.on('drain', function() {
            if (!stop) r.write(randomData);
            else c.end();
          });
        });
        server.listen(8765, function() {
          var client = net.connect({port: 8765});
          var startTime;
          var dataLength = 0;
          client.on('data', function(data) {
            var now = Date.now();
            dataLength += data.length;
            if (!startTime) startTime = now;
          });
          client.on('end', function() {
            var endTime = Date.now();
            var bytesPerSec = dataLength / (endTime - startTime) * 1000;
            var deviance = Math.abs(targetBytesPersSec - bytesPerSec) / targetBytesPersSec;
            // console.log('Target: ' + speed + ' MB/sec');
            // console.log('Actual: ' + roundPrec(bytesPerSec / 1048576, 2) + ' MB/sec');
            // console.log('Deviance: ' + roundPrec(deviance * 100, 2) + '%');
            assert.ok(deviance < 0.05);
            server.close();
            done();
          });
        });
      });
    });
  });
});
