/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Helper = require('../lib/helper');
const {User} = require('fabric-common');

const chai = require('chai');
const should = chai.should();

describe('Helper', () => {

	describe('#checkRegistrar', () => {

		it('should throw if called with missing argument', () => {
			(() => {
				Helper.checkRegistrar();
			}).should.throw(/Missing required argument "registrar"/);
		});

		it('should throw if called with argument that in not an instance of the class "User"', () => {
			(() => {
				Helper.checkRegistrar({thisIs: 'the wrong class'});
			}).should.throw(/Argument "registrar" must be an instance of the class "User" but is of type:/);
		});

		it('should throw if unable to retrieve signing identity due to missing method', () => {
			(() => {
				const registrar = new User('bob');
				registrar.getSigningIdentity = null;
				Helper.checkRegistrar(registrar);
			}).should.throw(/Argument "registrar" is found to be missing a method "getSigningIdentity\(\)"/);
		});

		it('should throw if unable to retrieve signing identity', () => {
			(() => {
				const registrar = new User('bob');
				Helper.checkRegistrar(registrar);
			}).should.throw(/Can not get signingIdentity from registrar/);
		});

		it('should not throw if valid registrar', () => {
			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';
			should.equal(Helper.checkRegistrar(registrar), undefined);
		});

	});

	describe('#getSubject', () => {

		const VALID_CERT = `-----BEGIN CERTIFICATE-----
			MIICEDCCAbagAwIBAgIUXoY6X7jIpHAAgL267xHEpVr6NSgwCgYIKoZIzj0EAwIw
			fzELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNh
			biBGcmFuY2lzY28xHzAdBgNVBAoTFkludGVybmV0IFdpZGdldHMsIEluYy4xDDAK
			BgNVBAsTA1dXVzEUMBIGA1UEAxMLZXhhbXBsZS5jb20wHhcNMTcwMTAzMDEyNDAw
			WhcNMTgwMTAzMDEyNDAwWjAQMQ4wDAYDVQQDEwVhZG1pbjBZMBMGByqGSM49AgEG
			CCqGSM49AwEHA0IABLoGEWBb+rQ/OuTBPlGVZO3jVWBcuC4+/pAq8axbtKorpORw
			J/GxahKPLr+vVLPNMyeLcnyJBGgneug+ajE8srijfzB9MA4GA1UdDwEB/wQEAwIF
			oDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDAYDVR0TAQH/BAIwADAd
			BgNVHQ4EFgQU9BUt7QfgDXx9g6zpzCyJGxXsNM0wHwYDVR0jBBgwFoAUF2dCPaqe
			gj/ExR2fW8OZ0bWcSBAwCgYIKoZIzj0EAwIDSAAwRQIgcWQbMzluyZsmvQCvGzPg
			f5B7ECxK0kdmXPXIEBiizYACIQD2x39Q4oVwO5uL6m3AVNI98C2LZWa0g2iea8wk
			BAHpeA==
			-----END CERTIFICATE-----`;


		it('should return the common name on success', () => {
			Helper.getSubject(VALID_CERT).should.equal('/CN=admin');
		});
	});

	describe('#parseURL', () => {

		it('should throw if invalid protocol', () => {
			(() => {
				Helper.parseURL('hyperledger.com');
			}).should.throw(/InvalidURL: url must start with http or https/);
		});

		it('should throw if not http or https protocol', () => {
			(() => {
				Helper.parseURL('ftp.hyperledger.com');
			}).should.throw(/InvalidURL: url must start with http or https/);
		});

		it('should throw if not http or https protocol', () => {
			(() => {
				Helper.parseURL('httpD.hyperledger.com');
			}).should.throw(/InvalidURL: url must start with http or https/);
		});

		it('should throw if no hostname', () => {
			(() => {
				Helper.parseURL('http://');
			}).should.throw(/InvalidURL: missing hostname/);
		});

		it('should return a URL Object on success', () => {
			const result = Helper.parseURL('http://hyperledger.com:4200');
			result.should.deep.equal({protocol: 'http', port: 4200, hostname: 'hyperledger.com'});
		});

	});

});
