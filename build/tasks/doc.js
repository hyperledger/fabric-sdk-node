/*
 Copyright 2016 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

	  http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

var gulp = require('gulp');
var jsdoc = require('gulp-jsdoc3');

gulp.task('doc', function () {
	gulp.src([
		'docs/index.md',
		'fabric-client/index.js',
		'fabric-client/lib/api.js',
		'fabric-client/lib/impl/FileKeyValueStore.js',
		'fabric-client/lib/impl/CouchDBKeyValueStore.js',
		'fabric-client/lib/impl/CryptoKeyStore.js',
		'fabric-client/lib/impl/CryptoSuite_ECDSA_AES.js',
		'fabric-client/lib/impl/ecdsa/key.js',
		'fabric-client/lib/impl/bccsp_pkcs11.js',
		'fabric-client/lib/impl/ecdsa/*',
		'fabric-client/lib/impl/aes/*',
		'fabric-client/lib/Chain.js',
		'fabric-client/lib/Orderer.js',
		'fabric-client/lib/Peer.js',
		'fabric-client/lib/User.js',
		'fabric-client/lib/Client.js',
		'fabric-client/lib/EventHub.js',
		'fabric-client/lib/Remote.js',
		'fabric-client/lib/X509Certificate.js',
		'fabric-ca-client/index.js',
		'fabric-ca-client/lib/FabricCAClientImpl.js'
	], { read: false })
	.pipe(jsdoc({
		opts: {
			tutorials: './docs',
			destination: './docs/gen'
		},
		templates: {
			systemName: 'Hyperledger Fabric SDK for node.js',
			theme: 'cosmo' //cerulean, cosmo, cyborg, flatly, journal, lumen, paper, readable, sandstone, simplex, slate, spacelab, superhero, united, yeti
		}
	}));
});
