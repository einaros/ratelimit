var events = require('events')
  , util = require('util');

module.exports = function(stream, limitInBytesPerSec) {
  var rateLimit = {
    end: function() {},
  };

  function resume() {
    stream.resume();
  }

  function manageReadStream(event) {
    var per = 50;
    var rate = limitInBytesPerSec * (per / 1000);
    var allowance = rate;
    var lastCheck = Date.now();
    var lastMeasurement = Date.now();

    function limiter(data) {
      var current = Date.now();
      var timePassed = (current - lastCheck);
      lastCheck = current;
      allowance += timePassed * (rate / per);
      if (allowance > rate) allowance = rate;
      var length = data.length;
      if (allowance <= length) {
        var pauseTime = (length - allowance) / (rate / per);
        stream.pause();
        setTimeout(resume, pauseTime);
      }
      allowance -= length;
    }
    stream.on('data', limiter);
    rateLimit.end = function() {
      stream.removeListener('data', limiter);
    }
  }

  function manageWriteStream() {
    var queue = [];
    var timerActive = false;
    var per = 100;
    var rate = limitInBytesPerSec * (per / 1000);
    var allowance = rate;
    var lastCheck = Date.now();
    var lastMeasurement = Date.now();

    function sendData(args) {
      var current = Date.now();
      var timePassed = (current - lastCheck);
      lastCheck = current;
      allowance += timePassed * (rate / per);
      if (allowance > rate) allowance = rate;
      var length = args[0].length;
      if (allowance < length) {
        var pauseTime = (length - allowance) / (rate / per);
        allowance -= length;
        timerActive = true;
        setTimeout(sendData.bind(null, args), pauseTime);
        return false;
      }
      else {
        timerActive = false;
        allowance -= length;
        var result = stream.write.call(stream, args);
        if (queue.length > 0) process.nextTick(function() {
          sendData(queue.shift());
        });
        return result;
      }
    }

    rateLimit.write = function() {
      var args = arguments;
      if (timerActive || queue.length > 0) {
        queue.push(args);
        return false;
      }
      return sendData.call(this, args);
    }
  }

  // if (stream.writable) manageWriteStream();
  if (stream.pipe) manageReadStream();
  return rateLimit;
}
