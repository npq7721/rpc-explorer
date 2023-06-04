var config = require("./../config.js");
var coins = require("../coins.js");
var utils = require("../utils.js");
const Cache = require("./../cache.js");
const miscCache = new Cache(process.env.MAX_MISC_CACHE ? process.env.MAX_MISC_CACHE : 100);


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

function executeMethod(method, useFrom, ...args) {
	return new Promise(function(resolve, reject) {
		let funcMap = METHOD_MAPPING[method];
		let promises = [];
		if(funcMap) {
			let addrApi = useFrom ? useFrom : config.addressApi;
			let func = funcMap[addrApi];
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
	return new Promise((resolve, reject) => {
		executeMethod("addressDetails", null, address, scriptPubkey, sort, limit, offset, assetName)
			.then(resolve)
			.catch(err => {
				if(err.message.includes("too large")) {
					executeMethod("addressDetails", "daemonRPC", address, scriptPubkey, sort, limit, offset, assetName)
						.then(resolve)
						.catch(reject)
				} else {
					reject(err);
				}

			})

	})
}

function getAddressDeltas(address, scriptPubkey, sort, limit, offset, start, numBlock, assetName) {
	return getAddressDeltasHelper(address, scriptPubkey, sort, limit, offset, start, numBlock, assetName);
}

function getAddressUTXOs(address, scriptPubkey) {
	if(config.addressApi === "daemonRPC") {
		scriptPubkey = null;
	}
	if(scriptPubkey) {
		address = null;
	}
	return executeMethod("addressUTXOs", null, address, scriptPubkey);
}

function getAddressBalance(address, scriptPubkey) {
	if(config.addressApi === "daemonRPC") {
		scriptPubkey = null;
	}
	if(scriptPubkey) {
		address = null;
	}
	return executeMethod("addressBalance", null, address, scriptPubkey);
}

function getAddressDeltasHelper(address, scriptPubkey, sort, limit, offset, start, numBlock, assetName) {
	//for now address deltas rpc does not do paging so there isn't a need to use limit and offset as cache key
	return miscCache.tryCache(`getAddressDeltas-${address}-${assetName}-${sort}-${limit}-${offset}-${start}-${numBlock}`, 300000, function() {
		return new Promise((resolve, reject) => {
			miscCache.tryCache(`getAddressDeltas-${address}-${assetName}--${start}-${numBlock}`, 100000, function() {
				return new Promise((resolve, reject) => {
					if(config.addressApi === "daemonRPC") {
						scriptPubkey = null;
					}
					executeMethod("addressDeltas", null, scriptPubkey ? null : address, scriptPubkey, sort, limit, offset, start, numBlock, assetName)
						.then(resolve)
						.catch(err => {
							let errMsg = err.error ? err.error.message : err.message;
							if (errMsg && errMsg.includes("too large")) {
								executeMethod("addressDeltas", "daemonRPC", address, scriptPubkey, sort, limit, offset, start, numBlock, assetName)
									.then(resolve)
									.catch(reject)
							} else {
								reject(err);
							}
						})
				})
			}).then(addressDeltas => {
				if(addressDeltas.result) {
					addressDeltas = addressDeltas.result;
				}
				let txids = {};
				let uniqueDelta = [];
				for (let index in addressDeltas) {
					let txid = addressDeltas[index].txid ? addressDeltas[index].txid : addressDeltas[index].tx_hash;
					addressDeltas[index].txid = txid;
					if(!txids[txid]) {
						txids[txid] = 1;
						uniqueDelta.push(addressDeltas[index]);
					}
				}
				addressDeltas = uniqueDelta;
				if (sort == "desc") {
					addressDeltas.reverse();
				}
				let end = Math.min(addressDeltas.length, limit + offset);
				let result = {
					txCount : addressDeltas.length,
					txids : [],
					blockHeightsByTxid : {}
				}
				addressDeltas = addressDeltas.slice(offset, end);
				for (var i in addressDeltas) {
					result.txids.push(addressDeltas[i].txid);
					result.blockHeightsByTxid[addressDeltas[i].txid] = addressDeltas[i].height;
				}
				resolve({addressDeltas : result, errors : null});
			}).catch(reject);
		});
	});
}



module.exports = {
	getSupportedAddressApis: getSupportedAddressApis,
	getCurrentAddressApiFeatureSupport: getCurrentAddressApiFeatureSupport,
	getAddressDetails: getAddressDetails,
	getAddressBalance : getAddressBalance,
	getAddressUTXOs : getAddressUTXOs,
	getAddressDeltas : getAddressDeltas
};
