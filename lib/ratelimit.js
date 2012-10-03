module.exports = function(stream, limitInBytesPerSec, intrusive) {
  var per = 50;
  var rate = Math.floor(limitInBytesPerSec * (per / 1000));

  /**
   * Base API
   */

  var api = {
    end: function() {}
  };

  /**
   * Readable Streams
   */

  function manageReadStream(event) {
    var allowance = rate;
    var lastCheck = Date.now();
    var lastMeasurement = Date.now();
    var prevPauseTime = 0;

    function resume() {
      stream.resume();
    }

    function onData(data) {
      var current = Date.now();
      var timePassed = (current - lastCheck);
      lastCheck = current;
      allowance += timePassed * (rate / per);
      if (allowance > rate) allowance = rate;
      var length = data.length;
      if (allowance <= length) {
        var pauseTime = (length - allowance) / (rate / per);
        stream.pause();
        var dampenedPauseTime = pauseTime * 0.3 + prevPauseTime * 0.7;
        setTimeout(resume, dampenedPauseTime);
        prevPauseTime = dampenedPauseTime;
      }
      else prevPauseTime = 0;
      allowance -= length;
    }
    stream.on('data', onData);

    api.end = function() {
      stream.removeListener('data', onData);
    }
  }

  /**
   * Writable Streams
   */

  function manageWriteStream(intrusive) {
    var queue = [];
    var timerActive = false;
    var allowance = rate;
    var lastCheck = Date.now();
    var lastMeasurement = Date.now();
    var pendingTimeout = -1;
    var prevPauseTime = 0;

    var write = stream.write;

    function sendData(args) {
      if (!stream.writable) return;
      pendingTimeout = -1;
      var current = Date.now();
      var timePassed = (current - lastCheck);
      lastCheck = current;
      allowance += timePassed * (rate / per);
      if (allowance > rate) allowance = rate;
      var data = args[0];
      var length = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
      if (allowance < length) {
        var pauseTime = (length - allowance) / (rate / per);
        timerActive = true;
        setTimeout(sendData.bind(null, args), pauseTime);
        return false;
      }
      else {
        timerActive = false;
        allowance -= length;
        var result = write.apply(stream, args);
        if (queue.length > 0) process.nextTick(function() {
          sendData(queue.shift());
        });
        return result;
      }
    }

    function writeSingleChunkToStream() {
      var args = arguments;
      if (timerActive || queue.length > 0) {
        queue.push(args);
        return false;
      }
      return sendData.call(this, args);
    }

    api.write = function(data, encoding, fd) {
      if (!stream.writable) {
        queue = [];
        if (pendingTimeout !== -1) clearTimeout(pendingTimeout);
        return;
      }
      var isBuffer = Buffer.isBuffer(data);
      if (!isBuffer && fd) {
        throw new Error('File descriptors are not supported yet by the rate limiter.');
      }
      var length = isBuffer ? data.length : Buffer.byteLength(data);
      if (length > rate) {
        data = isBuffer ? data : new Buffer(data, encoding);
        var chunks = Math.ceil(length / rate);
        for (var i = 0; i < chunks; ++i) {
          var start = i * rate;
          var end = Math.min(start + rate, length);
          var chunk = data.slice(start, end);
          writeSingleChunkToStream(chunk, encoding, fd);
        }
      }
      else writeSingleChunkToStream(data, encoding, fd);
    }
    api.writable = true;

    // If intrusive mode is on, replace stream.write with our own
    if (intrusive) stream.write = api.write;
  }

  /**
   * Setup
   */

  if (stream.writable) manageWriteStream(intrusive);
  if (stream.pipe) manageReadStream();
  return api;
}
