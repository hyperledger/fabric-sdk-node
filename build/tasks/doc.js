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
		'README.md',
		'hfc/index.js',
		'hfc/lib/api.js',
		'hfc/lib/impl/FileKeyValueStore.js',
		'hfc/lib/impl/CryptoSuite_ECDSA_AES.js',
		'hfc/lib/impl/ecdsa/key.js',
		'hfc/lib/impl/FabricCOPImpl.js',
		'hfc/lib/Chain.js',
		'hfc/lib/Member.js',
		'hfc/lib/Peer.js',
		'hfc/lib/X509Certificate.js'
	], {read: false})
	.pipe(jsdoc())
	.pipe(gulp.dest('./docs/gen'));
});
