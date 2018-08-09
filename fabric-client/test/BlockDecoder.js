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
const BlockDecoderRewire = rewire('../lib/BlockDecoder');
require('chai').should();

describe('BlockDecoder', () => {

	describe('#BlockDecoder.decode', () => {

	});

	describe('#BlockDecoder.decodeBlock', () => {

	});

	describe('#BlockDecoder.decodeTransaction', () => {

	});

	describe('#decodeBlockHeader', () => {

	});

	describe('#decodeBlockData', () => {

	});

	describe('#decodeBlockMetaData', () => {

	});

	describe('#decodeTransactionFilter', () => {

	});

	describe('#decodeLastConfigSequenceNumber', () => {

	});

	describe('#decodeMetadataSignatures', () => {

	});

	describe('#decodeMetadataValueSignatures', () => {

	});

	describe('#decodeBlockDataEnvelope', () => {

	});

	describe('#decodeEndorserTransaction', () => {

	});

	describe('#decodeConfigEnvelope', () => {

	});

	describe('#decodeConfig', () => {

	});

	describe('#decodeConfigUpdateEnvelope', () => {

	});

	describe('#decodeConfigUpdate', () => {

	});

	describe('#decodeConfigGroups', () => {

	});

	describe('#decodeConfigGroup', () => {

	});

	describe('#decodeConfigValues', () => {

	});

	describe('#decodeConfigValue', () => {

	});

	describe('#decodeConfigPolicies', () => {

	});

	describe('#decodeConfigPolicy', () => {

	});

	describe('#decodeImplicitMetaPolicy', () => {

	});

	describe('#decodeSignaturePolicyEnvelope', () => {

	});

	describe('#decodeSignaturePolicy', () => {

	});

	describe('#decodeMSPPrincipal', () => {

	});

	describe('#decodeConfigSignature', () => {

	});

	describe('#decodeSignatureHeader', () => {

	});

	describe('#decodeIdentity', () => {

	});

	describe('#decodeFabricMSPConfig', () => {

	});

	describe('#decodeFabricOUIdentifier', () => {

	});

	describe('#toPEMcerts', () => {

	});

	describe('#decodeSigningIdentityInfo', () => {

	});

	describe('#decodeKeyInfo', () => {

	});

	describe('#decodeHeader', () => {

	});

	describe('#decodeChannelHeader', () => {

	});

	describe('timeStampToDate()', () => {
		const timeStampToDate = BlockDecoderRewire.__get__('timeStampToDate');

		it('should return null for empty timestamp', () => {
			const res = timeStampToDate();
			res.should.eql('null');
		});

		it('should return ISO8601 string for a valid timestamp', () => {
			const now = new Date();
			const timestamp = {
				seconds: Math.floor(now.getTime()/1000),
				nanos: now.getMilliseconds() * 1000000
			};
			const res = timeStampToDate(timestamp);
			res.should.have.string(now.getMilliseconds().toString());
		});
	});

	describe('#decodeChaincodeActionPayload', () => {

	});

	describe('#decodeChaincodeProposalPayload', () => {

	});

	describe('#decodeChaincodeProposalPayloadInput', () => {

	});

	describe('#chaincodeTypeToString', () => {

	});

	describe('#decodeChaincodeSpec', () => {

	});

	describe('#decodeChaincodeInput', () => {

	});

	describe('#decodeChaincodeEndorsedAction', () => {

	});

	describe('#decodeEndorsement', () => {

	});

	describe('#decodeProposalResponsePayload', () => {

	});

	describe('#decodeChaincodeAction', () => {

	});

	describe('#decodeChaincodeEvents', () => {

	});

	describe('#decodeChaincodeID', () => {

	});

	describe('#decodeReadWriteSets', () => {

	});

	describe('#decodeKVRWSet', () => {

	});

	describe('#decodeKVRead', () => {

	});

	describe('#decodeRangeQueryInfo', () => {

	});

	describe('#decodeKVWrite', () => {

	});

	describe('#decodeResponse', () => {

	});

	describe('#decodeVersion', () => {

	});

});