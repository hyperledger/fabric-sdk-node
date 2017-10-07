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

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var CertificateAuthority = require('fabric-client/lib/CertificateAuthority.js');
var User = require('fabric-client/lib/User.js');
var utils = require('fabric-client/lib/utils.js');
var testutil = require('./util.js');


test('\n\n ** CertificateAuthority - constructor set get tests **\n\n', function (t) {
	testutil.resetDefaults();

	t.throws(()=> {
		new CertificateAuthority();
	},
	/Missing name parameter/,
	'Test Missing name parameter');

	t.throws(()=>{
		new CertificateAuthority('name');
	},
	/Missing url parameter/,
	'Test Missing url parameter');

	t.doesNotThrow(()=>{
		new CertificateAuthority('name', 'caname', 'url');
	},
	null,
	'Test good construction');

	var ca = new CertificateAuthority('name', 'caname', 'url','opts', 'certs', 'user');
	t.equals('name',ca.getName(),'test method getName');
	t.equals('caname',ca.getCaName(),'test method getCaName');
	t.equals('url',ca.getUrl(),'test method getUrl');
	t.equals('opts',ca.getConnectionOptions(),'test method getConnectionOptions');
	t.equals('certs',ca.getTlsCACerts(),'test method getTlsCACerts');
	t.equals('user',ca.getRegistrar(),'test method getRegistrar');

	let s = ca.toString();
	t.comment(s);
	if(s.indexOf('CertificateAuthority : {name : name')) {
		t.pass('Successfully tested toString');
	} else {
		t.fail('failed test of toString ');
	}

	t.end();
});
