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

  // Limit bursts to around 200 kB/sec
  ratelimit(res, 100 * 1024);

  var dataLength = 0;
  var startTime;
  res.on('data', function(data) {
    if (!startTime) startTime = Date.now();
    dataLength += data.length;
    var bytesPerSec = dataLength / (Date.now() - startTime) * 1000;
    cursor.up().eraseLine();
    console.log('Average speed: %s/sec', humanSize(bytesPerSec, 2));
  });
}).on('error', function(e) {
  console.log("Got error: " + e.message);
});
