var path = require('path');

module.exports.CHAINCODE_PATH = 'github.com/example_cc';

// temporarily set $GOPATH to the test fixture folder
module.exports.setupChaincodeDeploy = function() {
	process.env.GOPATH = path.join(__dirname, '../fixtures');
};