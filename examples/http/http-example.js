var http = require('http')
  , ratelimit = require('../../')
  , cursor = require('ansi')(process.stdout);

function humanSize(bytes) {
  if (bytes >= 1048576) return roundPrec(bytes / 1048576, 2) + ' MB';
  if (bytes >= 1024) return roundPrec(bytes / 1024, 2) + ' kB';
  return roundPrec(bytes, 2) + ' B';
}

function roundPrec(num, prec) {
  var mul = Math.pow(10, prec);
  return Math.round(num * mul) / mul;
}

http.get('http://upload.wikimedia.org/wikipedia/commons/6/60/Eol.jsc.nasa.gov_ESC_large_ISS005_ISS005-E-16279.JPG', function(res) {
  console.log('Got response: ' + res.statusCode + '. Please wait while file downloads.\n');

  // Limit bursts to around 100 kB/sec
  var limit = ratelimit(res, 65 * 1024);
  // Clear the rate limit after some time
  // setTimeout(limit.end, 7000);

  var dataLength = 0;
  var startTime;
  res.on('data', function(data) {
    var now = Date.now();
    if (!startTime) startTime = now;
    dataLength += data.length;
    var bytesPerSec = dataLength / (now - startTime) * 1000;
    cursor.up().eraseLine();
    console.log('Average over last two seconds: %s/sec', humanSize(bytesPerSec, 2));
    if (now - startTime > 2000) {
      startTime = now;
      dataLength = 0;
    }
  });
}).on('error', function(e) {
  console.log("Got error: " + e.message);
});
