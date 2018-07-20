/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

var tape = require('tape');
var _test = require('tape-promise').default;
var test = _test(tape);

var CertificateAuthority = require('fabric-client/lib/CertificateAuthority.js');
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
