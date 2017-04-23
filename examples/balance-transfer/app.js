/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('SampleWebApp');
var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var app = express();
var expressJWT = require('express-jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var config = require('./config.json');
var helper = require('./app/helper.js');
var channels = require('./app/create-channel.js');
var join = require('./app/join-channel.js');
var install = require('./app/install-chaincode.js');
var instantiate = require('./app/instantiate-chaincode.js');
var invoke = require('./app/invoke-transaction.js');
var query = require('./app/query.js');
var host = process.env.HOST || config.host;
var port = process.env.PORT || config.port;
///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// SET CONFIGURATONS ////////////////////////////
///////////////////////////////////////////////////////////////////////////////
app.options('*', cors());
app.use(cors());
//support parsing of application/json type post data
app.use(bodyParser.json());
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({
	extended: false
}));
// set secret variable
app.set('secret', 'thisismysecret');
app.use(expressJWT({
	secret: 'thisismysecret'
}).unless({
	path: ['/users']
}));
///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// START SERVER /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
var server = http.createServer(app).listen(port, function() {});
logger.info('****************** SERVER STARTED ************************');
logger.info('**************  http://' + host + ':' + port +
	'  ******************');
server.timeout = 240000;

function getErrorMessage(field) {
	var response = {
		success: false,
		message: field + ' field is missing or Invalid in the request'
	};
	return response;
}
///////////////////////////////////////////////////////////////////////////////
///////////////////////// REST ENDPOINTS START HERE ///////////////////////////
///////////////////////////////////////////////////////////////////////////////
// Register and enroll user
app.post('/users', function(req, res) {
	var username = req.body.username;
	var orgName = req.body.orgName;
	logger.debug('End point : /users');
	logger.debug('User name : ' + username);
	logger.debug('Org name  : ' + orgName);
	if (!username) {
		res.json(getErrorMessage('\'username\''));
		return;
	}
	if (!orgName) {
		res.json(getErrorMessage('\'orgName\''));
		return;
	}
	var token = jwt.sign({
		exp: Math.floor(Date.now() / 1000) + parseInt(config.jwt_expiretime),
		username: username,
		orgName: orgName
	}, app.get('secret'));
	helper.getRegisteredUsers(username, orgName, true).then(function(response) {
		if (response && typeof response !== 'string') {
			response.token = token;
			res.json(response);
		} else {
			res.json({
				success: false,
				message: response
			});
		}
	});
});
// Create Channel
app.post('/channels', function(req, res) {
	logger.info('<<<<<<<<<<<<<<<<< C R E A T E  C H A N N E L >>>>>>>>>>>>>>>>>');
	logger.debug('End point : /channels');
	var channelName = req.body.channelName;
	var channelConfigPath = req.body.channelConfigPath;
	logger.debug('Channel name : ' + channelName);
	logger.debug('channelConfigPath : ' + channelConfigPath); //../artifacts/channel/mychannel.tx
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!channelConfigPath) {
		res.json(getErrorMessage('\'channelConfigPath\''));
		return;
	}
	var token = req.body.token || req.query.token || req.headers[
		'x-access-token'];
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token.'
			});
		} else {
			logger.debug('User name : ' + decoded.username);
			logger.debug('Org name  : ' + decoded.orgName);
			channels.createChannel(channelName, channelConfigPath, decoded.username, decoded.orgName)
			.then(function(message) {
				res.send(message);
			});
		}
	});
});
// Join Channel
app.post('/channels/:channelName/peers', function(req, res) {
	logger.info('<<<<<<<<<<<<<<<<< J O I N  C H A N N E L >>>>>>>>>>>>>>>>>');
	var channelName = req.params.channelName;
	var peers = req.body.peers;
	logger.debug('channelName : ' + channelName);
	logger.debug('peers : ' + peers);
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peers || peers.length == 0) {
		res.json(getErrorMessage('\'peers\''));
		return;
	}
	var token = req.body.token || req.query.token || req.headers[
		'x-access-token'];
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token.'
			});
		} else {
			//res.send(d);
			logger.debug('User name : ' + decoded.username);
			logger.debug('Org name  : ' + decoded.orgName);
			join.joinChannel(channelName, peers, decoded.username, decoded.orgName).then(
				function(message) {
					res.send(message);
				});
		}
	});
});
// Install chaincode on target peers
app.post('/chaincodes', function(req, res) {
	logger.debug('==================== INSTALL CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.body.chaincodeName;
	var chaincodePath = req.body.chaincodePath;
	var chaincodeVersion = req.body.chaincodeVersion;
	logger.debug('peers : ' + peers); // target peers list
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('chaincodePath  : ' + chaincodePath);
	logger.debug('chaincodeVersion  : ' + chaincodeVersion);
	if (!peers || peers.length == 0) {
		res.json(getErrorMessage('\'peers\''));
		return;
	}
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!chaincodePath) {
		res.json(getErrorMessage('\'chaincodePath\''));
		return;
	}
	if (!chaincodeVersion) {
		res.json(getErrorMessage('\'chaincodeVersion\''));
		return;
	}
	var token = req.body.token || req.query.token || req.headers[
		'x-access-token'];
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token.'
			});
		} else {
			//res.send(d);
			logger.debug('User name : ' + decoded.username);
			logger.debug('Org name  : ' + decoded.orgName);
			install.installChaincode(peers, chaincodeName, chaincodePath, chaincodeVersion, decoded.username, decoded.orgName)
			.then(function(message) {
				res.send(message);
			});
		}
	});
});
// Instantiate chaincode on target peers
app.post('/channels/:channelName/chaincodes', function(req, res) {
	logger.debug('==================== INSTANTIATE CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.body.chaincodeName;
	var chaincodePath = req.body.chaincodePath;
	var chaincodeVersion = req.body.chaincodeVersion;
	var channelName = req.params.channelName;
	var functionName = req.body.functionName;
	var args = req.body.args;
	logger.debug('channelName  : ' + channelName);
	logger.debug('peers : ' + peers); // target peers list
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('chaincodePath  : ' + chaincodePath);
	logger.debug('chaincodeVersion  : ' + chaincodeVersion);
	logger.debug('functionName  : ' + functionName);
	logger.debug('args  : ' + args);
	if (!peers || peers.length == 0) {
		res.json(getErrorMessage('\'peers\''));
		return;
	}
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!chaincodePath) {
		res.json(getErrorMessage('\'chaincodePath\''));
		return;
	}
	if (!chaincodeVersion) {
		res.json(getErrorMessage('\'chaincodeVersion\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!functionName) {
		res.json(getErrorMessage('\'functionName\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}
	var token = req.body.token || req.query.token || req.headers[
		'x-access-token'];
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token.'
			});
		} else {
			//res.send(d);
			logger.debug('User name : ' + decoded.username);
			logger.debug('Org name  : ' + decoded.orgName);
			instantiate.instantiateChaincode(peers, channelName, chaincodeName, chaincodePath,
				chaincodeVersion, functionName, args, decoded.username, decoded.orgName)
			.then(function(message) {
				res.send(message);
			});
		}
	});
});
// Invoke transaction on chaincode on target peers
app.post('/channels/:channelName/chaincodes/:chaincodeName', function(req, res) {
	logger.debug('==================== INVOKE ON CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.params.chaincodeName;
	var chaincodeVersion = req.body.chaincodeVersion;
	var channelName = req.params.channelName;
	var args = req.body.args;
	logger.debug('channelName  : ' + channelName);
	logger.debug('peers : ' + peers); // target peers list
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('chaincodeVersion  : ' + chaincodeVersion);
	logger.debug('args  : ' + args);
	if (!peers || peers.length == 0) {
		res.json(getErrorMessage('\'peers\''));
		return;
	}
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!chaincodeVersion) {
		res.json(getErrorMessage('\'chaincodeVersion\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}
	var token = req.body.token || req.query.token || req.headers[
		'x-access-token'];
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token.'
			});
		} else {
			//res.send(d);
			logger.debug('User name : ' + decoded.username);
			logger.debug('Org name  : ' + decoded.orgName);
			let promise = invoke.invokeChaincode(peers, channelName, chaincodeName,
				chaincodeVersion, args, decoded.username, decoded.orgName);
			promise.then(function(message) {
				res.send(message);
			});
		}
	});
});
// Query on chaincode on target peers
app.get('/channels/:channelName/chaincodes/:chaincodeName', function(req, res) {
	logger.debug('==================== QUERY ON CHAINCODE ==================');
	var channelName = req.params.channelName;
	var chaincodeName = req.params.chaincodeName;
	let peer = req.query.peer;
	let args = req.query.args;
	let chaincodeVersion = req.query.chaincodeVersion;
	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('args : ' + args);
	logger.debug('chaincodeVersion : ' + chaincodeVersion);
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!chaincodeVersion) {
		res.json(getErrorMessage('\'chaincodeVersion\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}
	args = args.replace(/'/g, '"');
	args = JSON.parse(args);
	logger.debug(args);
	var token = req.body.token || req.query.token || req.headers[
		'x-access-token'];
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token.'
			});
		} else {
			//res.send(d);
			logger.debug('User name : ' + decoded.username);
			logger.debug('Org name  : ' + decoded.orgName);
			query.queryChaincode(peer, channelName, chaincodeName, chaincodeVersion,
				args, decoded.username, decoded.orgName)
			.then(function(message) {
				res.send(message);
			});
		}
	});
});
//  Query Get Block by BlockNumber
app.get('/channels/:channelName/blocks/:blockId', function(req, res) {
	logger.debug('==================== GET BLOCK BY NUMBER ==================');
	//logger.debug('peers : '+req.body.peers);// target peers list
	let blockId = req.params.blockId;
	let peer = req.query.peer;
	logger.debug('channelName : ' + req.params.channelName);
	logger.debug('BlockID : ' + blockId);
	logger.debug('Peer : ' + peer);
	if (!blockId) {
		res.json(getErrorMessage('\'blockId\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	var token = req.body.token || req.query.token || req.headers[
		'x-access-token'];
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token.'
			});
		} else {
			logger.debug('User name : ' + decoded.username);
			logger.debug('Org name  : ' + decoded.orgName);
			query.getBlockByNumber(peer, blockId, decoded.username, decoded.orgName)
				.then(function(message) {
					res.send(message);
				});
		}
	});
});
// Query Get Transaction by Transaction ID
app.get('/channels/:channelName/transactions/:trxnId', function(req, res) {
	logger.debug(
		'================ GET TRANSACTION BY TRANSACTION_ID ======================'
	);
	logger.debug('channelName : ' + req.params.channelName);
	let trxnId = req.params.trxnId;
	let peer = req.query.peer;
	if (!trxnId) {
		res.json(getErrorMessage('\'trxnId\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	var token = req.body.token || req.query.token || req.headers[
		'x-access-token'];
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token.'
			});
		} else {
			logger.debug('User name : ' + decoded.username);
			logger.debug('Org name  : ' + decoded.orgName);
			query.getTransactionByID(peer, trxnId, decoded.username, decoded.orgName)
				.then(function(message) {
					res.send(message);
				});
		}
	});
});
// Query Get Block by Hash
app.get('/channels/:channelName/blocks', function(req, res) {
	logger.debug('================ GET BLOCK BY HASH ======================');
	//logger.debug('peers : '+req.body.peers);// target peers list
	logger.debug('channelName : ' + req.params.channelName);
	let hash = req.query.hash;
	let peer = req.query.peer;
	if (!hash) {
		res.json(getErrorMessage('\'hash\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	var token = req.body.token || req.query.token || req.headers[
		'x-access-token'];
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token.'
			});
		} else {
			logger.debug('User name : ' + decoded.username);
			logger.debug('Org name  : ' + decoded.orgName);
			query.getBlockByHash(peer, hash, decoded.username, decoded.orgName).then(
				function(message) {
					res.send(message);
				});
		}
	});
});
//Query for Channel Information
app.get('/channels/:channelName', function(req, res) {
	logger.debug(
		'================ GET CHANNEL INFORMATION ======================');
	//logger.debug('peers : '+req.body.peers);// target peers list
	logger.debug('channelName : ' + req.params.channelName);
	let peer = req.query.peer;
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	var token = req.body.token || req.query.token || req.headers[
		'x-access-token'];
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token.'
			});
		} else {
			logger.debug('User name : ' + decoded.username);
			logger.debug('Org name  : ' + decoded.orgName);
			query.getChainInfo(peer, decoded.username, decoded.orgName).then(
				function(message) {
					res.send(message);
				});
		}
	});
});
// Query to fetch all Installed/instantiated chaincodes
app.get('/chaincodes', function(req, res) {
	var peer = req.query.peer;
	var installType = req.query.type;
	//TODO: add Constnats
	if (installType === 'installed') {
		logger.debug(
			'================ GET INSTALLED CHAINCODES ======================');
	} else {
		logger.debug(
			'================ GET INSTANTIATED CHAINCODES ======================');
	}
	logger.debug('peer: ' + req.query.peer);
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	var token = req.body.token || req.query.token || req.headers[
		'x-access-token'];
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token.'
			});
		} else {
			logger.debug('User name : ' + decoded.username);
			logger.debug('Org name  : ' + decoded.orgName);
			query.getInstalledChaincodes(peer, installType, decoded.username, decoded.orgName)
			.then(function(message) {
				res.send(message);
			});
		}
	});
});
// Query to fetch channels
app.get('/channels', function(req, res) {
	logger.debug('================ GET CHANNELS ======================');
	logger.debug('End point : /channels');
	//logger.debug('peers : '+req.body.peers);// target peers list
	logger.debug('peer: ' + req.query.peer);
	var peer = req.query.peer;
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	var token = req.body.token || req.query.token || req.headers[
		'x-access-token'];
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token.'
			});
		} else {
			logger.debug('User name : ' + decoded.username);
			logger.debug('Org name  : ' + decoded.orgName);
			query.getChannels(peer, decoded.username, decoded.orgName).then(function(
				message) {
				res.send(message);
			});
		}
	});
});
