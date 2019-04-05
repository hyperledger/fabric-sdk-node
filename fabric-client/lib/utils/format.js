const Long = require('long');

/*
 * Converts to a Long number
 * Returns a null if the incoming value is not a string that represents a
 * number or an actual javascript number. Also allows for a Long object to be
 * passed in as the value to convert
 */
module.exports.convertToLong = (value) => {
	let result;
	if (Long.isLong(value)) {
		result = value; // already a long
	} else if (typeof value !== 'undefined' && value !== null) {
		result = Long.fromValue(value);
		// Long will return a zero for invalid strings so make sure we did
		// not get a real zero as the incoming value
		if (result.equals(Long.ZERO)) {
			if (Number.isInteger(value) || value === '0') {
				// all good
			} else {
				// anything else must be a string that is not a valid number
				throw new Error(`value:${value} is not a valid number `);
			}
		}
	} else {
		throw new Error('value parameter is missing');
	}

	return result;
};
