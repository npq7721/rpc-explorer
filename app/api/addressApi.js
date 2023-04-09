var config = require("./../config.js");
var coins = require("../coins.js");
var utils = require("../utils.js");

var coinConfig = coins[config.coin];

var electrumAddressApi = require("./electrumAddressApi.js");
var blockchainAddressApi = require("./blockchainAddressApi.js");
var blockchairAddressApi = require("./blockchairAddressApi.js");
var blockcypherAddressApi = require("./blockcypherAddressApi.js");
var rpcApi = require("./coreApi.js");

const ADDRESS_APIS = {
	BLOCKCHAIN : "blockchain.com",
	BLOCKCHAIR : "blockchair.com",
	BLOCKCYPHER : "blockcypher.com",
	ELECTRUMX : "electrumx",
	DAEMONRPC : "daemonRPC"
}

const METHOD_MAPPING = {
	addressDetails : {
		"blockchain.com" : blockchainAddressApi.getAddressDetails,
		"blockchair.com" : blockchairAddressApi.getAddressDetails,
		"blockcypher.com" : blockcypherAddressApi.getAddressDetails,
		"electrumx" : electrumAddressApi.getAddressDetails,
		"daemonRPC" : rpcApi.getAddressDetails
	},
	addressUTXOs : {
		"electrumx" : electrumAddressApi.getAddressUTXOs,
		"daemonRPC" : rpcApi.getAddressUTXOs
	},
	addressBalance : {
		"electrumx" : electrumAddressApi.getAddressBalance,
		"daemonRPC" : rpcApi.getAddressBalance
	},
	addressDeltas : {
		"daemonRPC" : rpcApi.getAddressDeltas,
		"electrumx" : electrumAddressApi.getAddressTxids
	}
}

function getSupportedAddressApis() {
	return Object.values(ADDRESS_APIS);
}

function getCurrentAddressApiFeatureSupport() {
	switch(config.addressApi) {
		case ADDRESS_APIS.BLOCKCHAIN:
			return {
				pageNumbers: true,
				sortDesc: true,
				sortAsc: true
			};
		case  ADDRESS_APIS.BLOCKCHAIR:
			return {
				pageNumbers: true,
				sortDesc: true,
				sortAsc: false
			};
		case  ADDRESS_APIS.BLOCKCYPHER:
			return {
				pageNumbers: true,
				sortDesc: true,
				sortAsc: false
			};
		case  ADDRESS_APIS.ELECTRUMX:
			return {
				pageNumbers: true,
				sortDesc: true,
				sortAsc: true
			};
		case  ADDRESS_APIS.DAEMONRPC:
			return {
				pageNumbers: true,
				sortDesc: false,
				sortAsc: false
			}
	}
}

function executeMethod(method, ...args) {
	return new Promise(function(resolve, reject) {
		var funcMap = METHOD_MAPPING[method];
		var promises = [];
		if(funcMap) {
			var func = funcMap[config.addressApi];
			if(func) {
			//	console.log("%s - %O", func, args);
				promises.push(func.apply(null, args));
			} else {
				promises.push(new Promise(function(resolve, reject) {
					result = {};
					result[method] = null;
					result.errors = ["No address API configured for method " + method];
					resolve(result);
				}));
			}
		} else {
			promises.push(new Promise(function(resolve, reject) {
				result = {};
				result[method] = null;
				result.errors = ["method " + method + " is not supported"];
				resolve(result);
			}));
		}
		Promise.all(promises).then(function(results) {
			if (results && results.length > 0) {
				resolve(results[0]);

			} else {
				resolve(null);
			}
		}).catch(function(err) {
			utils.logError("239x7rhsd0gs", err);

			reject(err);
		});
	});
}

function getAddressDetails(address, scriptPubkey, sort, limit, offset, assetName) {
	return executeMethod("addressDetails", address, scriptPubkey, sort, limit, offset, assetName);
}

function getAddressDeltas(address, scriptPubkey, sort, limit, offset, start, numBlock, assetName) {
	if(config.addressApi === "daemonRPC") {
		scriptPubkey = null;
	}
	if(scriptPubkey) {
		address = null;
	}
	return executeMethod("addressDeltas", address, scriptPubkey, sort, limit, offset, start, numBlock, assetName);
}

function getAddressUTXOs(address, scriptPubkey) {
	if(config.addressApi === "daemonRPC") {
		scriptPubkey = null;
	}
	if(scriptPubkey) {
		address = null;
	}
	return executeMethod("addressUTXOs", address, scriptPubkey);
}

function getAddressBalance(address, scriptPubkey) {
	if(config.addressApi === "daemonRPC") {
		scriptPubkey = null;
	}
	if(scriptPubkey) {
		address = null;
	}
	return executeMethod("addressBalance", address, scriptPubkey);
}



module.exports = {
	getSupportedAddressApis: getSupportedAddressApis,
	getCurrentAddressApiFeatureSupport: getCurrentAddressApiFeatureSupport,
	getAddressDetails: getAddressDetails,
	getAddressBalance : getAddressBalance,
	getAddressUTXOs : getAddressUTXOs,
	getAddressDeltas : getAddressDeltas
};
