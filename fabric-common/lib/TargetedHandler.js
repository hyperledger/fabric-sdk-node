const settle = require('promise-settle');

async function TargetedHandler(signedEnvelope, request) {
	const {targets, requestTimeout, chaincodeId} = request;
	const promises = [];
	for (const endorser of targets) {
		if (chaincodeId && !endorser.hasChaincode(chaincodeId)) {
			// apply a chaincodeId filter
			const chaincodeError = new Error(`Peer ${endorser.name} is not running chaincode ${this.chaincodeId}`);
			endorser.getCharacteristics(chaincodeError);
			promises.push(Promise.reject(chaincodeError));
		} else {
			promises.push(endorser.sendProposal(signedEnvelope, requestTimeout));
		}
	}
	const results = await settle(promises);
	const errors = [];
	const responses = [];
	results.forEach((result) => {
		if (!result.isFulfilled()) {
			errors.push(result.reason());
			return;
		}

		const response = result.value();
		if (response && response.response && response.response.status) {
			responses.push(response);
		} else if (response instanceof Error) {
			errors.push(response);
		} else {
			errors.push(new Error('Missing response status'));
		}
	});

	return {
		errors,
		responses
	};
}

module.exports = TargetedHandler;

