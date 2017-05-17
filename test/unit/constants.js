var os = require('os');
var path = require('path');

var tempdir = path.join(os.tmpdir(), 'hfc');

module.exports = {
	tempdir: tempdir
};