/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const rewire = require('rewire');

const Client = require('../../lib/Client');
const fs = require('fs');
const NetworkConfig = rewire('../../lib/impl/NetworkConfig_1_0');
const path = require('path');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
chai.should();
chai.use(chaiAsPromised);
chai.use(sinonChai);

const pem = fs.readFileSync(path.resolve(__dirname, '..', 'data', 'ccp', 'pems', 'ca.pem'), 'utf8');

describe('NetworkConfig_1_0', () => {

	let mockClient;
	let CertificateAuthorityStub;
	let revert;

	beforeEach(() => {
		mockClient = sinon.createStubInstance(Client);
		CertificateAuthorityStub = sinon.stub();
		revert = [
			NetworkConfig.__set__('CertificateAuthority', CertificateAuthorityStub)
		];
	});

	afterEach(() => {
		revert.forEach(Function.prototype.call, Function.prototype.call);
	});

	describe('#getNetworkConfigLocation', () => {

		it('should return the network config location', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getNetworkConfigLocation().should.equal(ccpPath);
		});

	});

	describe('#getPeer', () => {

		it('should return correct peer config for a peer with no TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getPeer('peer0.org1.example.com');
			mockClient.newPeer.should.have.been.calledOnceWithExactly('grpc://localhost:7051', {
				name: 'peer0.org1.example.com',
				pem: null,
				'request-timeout': 300000
			});
		});

		it('should return correct peer config for a peer with embedded TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-embedded-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getPeer('peer0.org1.example.com');
			mockClient.newPeer.should.have.been.calledOnceWithExactly('grpcs://localhost:7051', {
				name: 'peer0.org1.example.com',
				pem,
				'request-timeout': 300000
			});
		});

		it('should return correct peer config for a peer with absolute paths to TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-relative-ccp-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			ccp.peers['peer0.org1.example.com'].tlsCACerts.path = path.resolve(__dirname, '..', 'data', 'ccp', 'pems', 'ca.pem');
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getPeer('peer0.org1.example.com');
			mockClient.newPeer.should.have.been.calledOnceWithExactly('grpcs://localhost:7051', {
				name: 'peer0.org1.example.com',
				pem,
				'request-timeout': 300000
			});
		});


		it('should return correct peer config for a peer with relative (to CCP) paths to TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-relative-ccp-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getPeer('peer0.org1.example.com');
			mockClient.newPeer.should.have.been.calledOnceWithExactly('grpcs://localhost:7051', {
				name: 'peer0.org1.example.com',
				pem,
				'request-timeout': 300000
			});
		});


		it('should return correct peer config for a peer with relative (to CWD) paths to TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-relative-cwd-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getPeer('peer0.org1.example.com');
			mockClient.newPeer.should.have.been.calledOnceWithExactly('grpcs://localhost:7051', {
				name: 'peer0.org1.example.com',
				pem,
				'request-timeout': 300000
			});
		});

		it('should throw when peer config for a peer has missing relative (to CCP) paths to TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-missing-relative-ccp-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			(() => {
				networkConfig.getPeer('peer0.org1.example.com');
			}).should.throw(/ENOENT/);
		});
	});

	describe('#getCertificateAuthority', () => {

		it('should return correct certificate authority config for a peer with no TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getCertificateAuthority('ca.example.com');
			CertificateAuthorityStub.should.have.been.calledOnceWithExactly('ca.example.com', 'ca.example.com', 'http://localhost:7054', undefined, null, undefined);
		});

		it('should return correct certificate authority config for a certificate authority with embedded TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-embedded-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getCertificateAuthority('ca.example.com');
			CertificateAuthorityStub.should.have.been.calledOnceWithExactly('ca.example.com', 'ca.example.com', 'https://localhost:7054', undefined, pem, undefined);
		});

		it('should return correct certificate authority config for a certificate authority with absolute paths to TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-relative-ccp-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			ccp.certificateAuthorities['ca.example.com'].tlsCACerts.path = path.resolve(__dirname, '..', 'data', 'ccp', 'pems', 'ca.pem');
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getCertificateAuthority('ca.example.com');
			CertificateAuthorityStub.should.have.been.calledOnceWithExactly('ca.example.com', 'ca.example.com', 'https://localhost:7054', undefined, pem, undefined);
		});


		it('should return correct certificate authority config for a certificate authority with relative (to CCP) paths to TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-relative-ccp-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getCertificateAuthority('ca.example.com');
			CertificateAuthorityStub.should.have.been.calledOnceWithExactly('ca.example.com', 'ca.example.com', 'https://localhost:7054', undefined, pem, undefined);
		});


		it('should return correct certificate authority config for a certificate authority with relative (to CWD) paths to TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-relative-cwd-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getCertificateAuthority('ca.example.com');
			CertificateAuthorityStub.should.have.been.calledOnceWithExactly('ca.example.com', 'ca.example.com', 'https://localhost:7054', undefined, pem, undefined);
		});

		it('should throw when certificate authority config for a certificate authority has missing relative (to CCP) paths to TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-missing-relative-ccp-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			(() => {
				networkConfig.getCertificateAuthority('ca.example.com');
			}).should.throw(/ENOENT/);
		});
	});

	describe('#getOrderer', () => {

		it('should return correct orderer config for a orderer with no TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getOrderer('orderer.example.com');
			mockClient.newOrderer.should.have.been.calledOnceWithExactly('grpc://localhost:7050', {
				name: 'orderer.example.com',
				pem: null,
				'request-timeout': 300000
			});
		});

		it('should return correct orderer config for a orderer with embedded TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-embedded-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getOrderer('orderer.example.com');
			mockClient.newOrderer.should.have.been.calledOnceWithExactly('grpcs://localhost:7050', {
				name: 'orderer.example.com',
				pem,
				'request-timeout': 300000
			});
		});

		it('should return correct orderer config for a orderer with absolute paths to TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-relative-ccp-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			ccp.peers['peer0.org1.example.com'].tlsCACerts.path = path.resolve(__dirname, '..', 'data', 'ccp', 'pems', 'ca.pem');
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getOrderer('orderer.example.com');
			mockClient.newOrderer.should.have.been.calledOnceWithExactly('grpcs://localhost:7050', {
				name: 'orderer.example.com',
				pem,
				'request-timeout': 300000
			});
		});


		it('should return correct orderer config for a orderer with relative (to CCP) paths to TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-relative-ccp-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getOrderer('orderer.example.com');
			mockClient.newOrderer.should.have.been.calledOnceWithExactly('grpcs://localhost:7050', {
				name: 'orderer.example.com',
				pem,
				'request-timeout': 300000
			});
		});


		it('should return correct orderer config for a orderer with relative (to CWD) paths to TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-relative-cwd-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			networkConfig.getOrderer('orderer.example.com');
			mockClient.newOrderer.should.have.been.calledOnceWithExactly('grpcs://localhost:7050', {
				name: 'orderer.example.com',
				pem,
				'request-timeout': 300000
			});
		});

		it('should throw when orderer config for a orderer has missing relative (to CCP) paths to TLS CA certs', () => {
			const ccpPath = path.resolve(__dirname, '..', 'data', 'ccp', 'connection-missing-relative-ccp-pems.json');
			const ccpContents = fs.readFileSync(ccpPath, 'utf8');
			const ccp = JSON.parse(ccpContents);
			const networkConfig = new NetworkConfig(ccp, mockClient, ccpPath);
			(() => {
				networkConfig.getOrderer('orderer.example.com');
			}).should.throw(/ENOENT/);
		});
	});

});