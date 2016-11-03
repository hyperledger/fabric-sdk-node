var path = require('path');

module.exports.CHAINCODE_PATH = 'github.com/example_cc';
module.exports.KVS = '/tmp/hfc-test-kvs';

// temporarily set $GOPATH to the test fixture folder
module.exports.setupChaincodeDeploy = function() {
	process.env.GOPATH = path.join(__dirname, '../fixtures');
};