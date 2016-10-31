var fs = require('fs-extra');
var path = require('path');

module.exports.CHAINCODE_PATH = 'github.com/example_cc';
module.exports.CHAINCODE_FILE = 'example_cc.go';

module.exports.setupChaincodeDeploy = function() {
	var gopath = process.env.GOPATH;

	if (!gopath) {
		throw new Error('Environment variable $GOPATH must be set for the SDK to deploy chaincode');
	}
	var src = path.join(__dirname, '../fixtures/example_cc.go');

	var fullpath = path.join(gopath, 'src', module.exports.CHAINCODE_PATH);
	var target = path.join(fullpath, module.exports.CHAINCODE_FILE);

	fs.mkdirs(fullpath, function(err1) {
		if (err1) throw new Error(err1);

		fs.copy(src, target, function(err2) {
			if (err2) throw new Error(err2);

			return;
		});

	});
};