var debug = require("debug");
var debugLog = debug("btcexp:router");

var express = require('express');
var csurf = require('csurf');
var router = express.Router();
var util = require('util');
var moment = require('moment');
var bitcoinCore = require("bitcoin-core");
var qrcode = require('qrcode');
var bitcoinjs = require('bitcoinjs-lib');
var sha256 = require("crypto-js/sha256");
var hexEnc = require("crypto-js/enc-hex");
var Decimal = require("decimal.js");
var marked = require("marked");

var utils = require('./../app/utils.js');
var pingUtils = require('./../app/pingUtils.js');
var coins = require("./../app/coins.js");
var config = require("./../app/config.js");
var coreApi = require("./../app/api/coreApi.js");
var addressApi = require("./../app/api/addressApi.js");
var Session = require("./session.js");

const forceCsrf = csurf({ ignoreMethods: [] });
const pug = require('pug');

var routing = function(path, method, sessionMethod, args = null, hashNext = true) {
	if(hashNext) {
		router[method](path, (req, res, next) => {
			var session = new Session(req, res, next, config);
			session[sessionMethod].apply(session, args);
		});
	} else {
		router[method](path, (req, res) => {
			var session = new Session(req, res, null, config);
			session[sessionMethod].apply(session, args);
		});
	}
}

router.get("/", function(req, res, next) {
	var session = new Session(req,res,next);
	if(session.isRenderConnect()) {
		return;
	}
	session.renderHome();
});

router.get("/node-status", function(req, res, next) {
	coreApi.getBlockchainInfo().then(function(getblockchaininfo) {
		res.locals.getblockchaininfo = getblockchaininfo;

		coreApi.getNetworkInfo().then(function(getnetworkinfo) {
			res.locals.getnetworkinfo = getnetworkinfo;

			coreApi.getUptimeSeconds().then(function(uptimeSeconds) {
				res.locals.uptimeSeconds = uptimeSeconds;

				coreApi.getNetTotals().then(function(getnettotals) {
					res.locals.getnettotals = getnettotals;

					res.render("node-status");

					next();

				}).catch(function(err) {
					res.locals.userMessage = "Error getting node status: (id=0), err=" + err;

					res.render("node-status");

					next();
				});
			}).catch(function(err) {
				res.locals.userMessage = "Error getting node status: (id=1), err=" + err;

				res.render("node-status");

				next();
			});
		}).catch(function(err) {
			res.locals.userMessage = "Error getting node status: (id=2), err=" + err;

			res.render("node-status");

			next();
		});
	}).catch(function(err) {
		res.locals.userMessage = "Error getting node status: (id=3), err=" + err;

		res.render("node-status");

		next();
	});
});

router.get("/mempool-summary", function(req, res, next) {
	coreApi.getMempoolInfo().then(function(getmempoolinfo) {
		res.locals.getmempoolinfo = getmempoolinfo;

		coreApi.getMempoolStats().then(function(mempoolstats) {
			res.locals.mempoolstats = mempoolstats;

			res.render("mempool-summary");

			next();
		});
	}).catch(function(err) {
		res.locals.userMessage = "Error: " + err;

		res.render("mempool-summary");

		next();
	});
});

router.get("/peers", function(req, res, next) {
	coreApi.getPeerSummary().then(function(peerSummary) {
		res.locals.peerSummary = peerSummary;

		var peerIps = [];
		for (var i = 0; i < peerSummary.getpeerinfo.length; i++) {
			var ipWithPort = peerSummary.getpeerinfo[i].addr;
			if (ipWithPort.lastIndexOf(":") >= 0) {
				var ip = ipWithPort.substring(0, ipWithPort.lastIndexOf(":"));
				if (ip.trim().length > 0) {
					peerIps.push(ip.trim());
				}
			}
		}

		if (peerIps.length > 0) {
			pingUtils.geoLocateIpAddresses(peerIps).then(function(results) {
				res.locals.peerIpSummary = results;

				res.render("peers");

				next();
			});
		} else {
			res.render("peers");

			next();
		}
	}).catch(function(err) {
		res.locals.userMessage = "Error: " + err;

		res.render("peers");

		next();
	});
});

// router.post("/connect", function(req, res, next) {
// 	var host = req.body.host;
// 	var port = req.body.port;
// 	var username = req.body.username;
// 	var password = req.body.password;
//
// 	res.cookie('rpc-host', host);
// 	res.cookie('rpc-port', port);
// 	res.cookie('rpc-username', username);
//
// 	req.session.host = host;
// 	req.session.port = port;
// 	req.session.username = username;
//
// 	var newClient = new bitcoinCore({
// 		host: host,
// 		port: port,
// 		username: username,
// 		password: password,
// 		timeout: 30000
// 	});
//
// 	debugLog("created new rpc client: " + newClient);
//
// 	global.rpcClient = newClient;
//
// 	req.session.userMessage = "<strong>Connected via RPC</strong>: " + username + " @ " + host + ":" + port;
// 	req.session.userMessageType = "success";
//
// 	res.redirect("/");
// });
//
// router.get("/disconnect", function(req, res, next) {
// 	res.cookie('rpc-host', "");
// 	res.cookie('rpc-port', "");
// 	res.cookie('rpc-username', "");
//
// 	req.session.host = "";
// 	req.session.port = "";
// 	req.session.username = "";
//
// 	debugLog("destroyed rpc client.");
//
// 	global.rpcClient = null;
//
// 	req.session.userMessage = "Disconnected from node.";
// 	req.session.userMessageType = "success";
//
// 	res.redirect("/");
// });

router.get("/changeSetting", function(req, res, next) {
	if (req.query.name) {
		req.session[req.query.name] = req.query.value;

		res.cookie('user-setting-' + req.query.name, req.query.value);
	}

	res.redirect(req.headers.referer);
});

router.get("/search", function(req, res, next) {
	if (!req.body.query) {
		req.session.userMessage = "Enter a block height, block hash, or transaction id.";
		req.session.userMessageType = "primary";

		res.render("search");

		next();
	}
});

router.post("/search", function(req, res, next) {
	if (!req.body.query) {
		req.session.userMessage = "Enter a block height, block hash, or transaction id.";

		res.redirect("/");

		return;
	}

	var query = req.body.query.toLowerCase().trim();
	var rawCaseQuery = req.body.query.trim();

	req.session.query = req.body.query;

	if (query.length == 64) {
		coreApi.getRawTransaction({query : {txid : query}}).then(function(tx) {
			if (tx) {
				res.redirect("/tx/" + query);

				return;
			}

			coreApi.getBlockByHash(query).then(function(blockByHash) {
				if (blockByHash) {
					res.redirect("/block/" + query);

					return;
				}

				coreApi.getAddress(rawCaseQuery).then(function(validateaddress) {
					if (validateaddress && validateaddress.isvalid) {
						res.redirect("/address/" + rawCaseQuery);

						return;
					}
				});

				req.session.userMessage = "No results found for query: " + query;

				res.redirect("/");

			}).catch(function(err) {
				req.session.userMessage = "No results found for query: " + query;

				res.redirect("/");
			});

		}).catch(function(err) {
			coreApi.getBlockByHash(query).then(function(blockByHash) {
				if (blockByHash) {
					res.redirect("/block/" + query);

					return;
				}

				req.session.userMessage = "No results found for query: " + query;

				res.redirect("/");

			}).catch(function(err) {
				req.session.userMessage = "No results found for query: " + query;

				res.redirect("/");
			});
		});

	} else if (!isNaN(query)) {
		coreApi.getBlockByHeight(parseInt(query)).then(function(blockByHeight) {
			if (blockByHeight) {
				res.redirect("/block-height/" + query);

				return;
			}

			req.session.userMessage = "No results found for query: " + query;

			res.redirect("/");
		});
	} else {
		coreApi.getAddress(rawCaseQuery).then(function(validateaddress) {
			if (validateaddress && validateaddress.isvalid) {
				res.redirect("/address/" + rawCaseQuery);

				return;
			}

			req.session.userMessage = "No results found for query: " + rawCaseQuery;

			res.redirect("/");
		});
	}
});

router.get("/block-height/:blockHeight", function(req, res, next) {
	var blockHeight = parseInt(req.params.blockHeight);

	res.locals.blockHeight = blockHeight;

	res.locals.result = {};

	var limit = config.site.blockTxPageSize;
	var offset = 0;

	if (req.query.limit) {
		limit = parseInt(req.query.limit);

		// for demo sites, limit page sizes
		if (config.demoSite && limit > config.site.blockTxPageSize) {
			limit = config.site.blockTxPageSize;

			res.locals.userMessage = "Transaction page size limited to " + config.site.blockTxPageSize + ". If this is your site, you can change or disable this limit in the site config.";
		}
	}

	if (req.query.offset) {
		offset = parseInt(req.query.offset);
	}

	res.locals.limit = limit;
	res.locals.offset = offset;
	res.locals.paginationBaseUrl = "/block-height/" + blockHeight;

	coreApi.getBlockByHeight(blockHeight).then(function(result) {
		res.locals.result.getblockbyheight = result;

		coreApi.getBlockByHashWithTransactions(result.hash, limit, offset).then(function(result) {
			res.locals.result.getblock = result.getblock;
			res.locals.result.transactions = result.transactions;
			res.render("block");

			next();
		});
	});
});

router.get("/block/:blockHash", function(req, res, next) {
	var blockHash = req.params.blockHash;

	res.locals.blockHash = blockHash;

	res.locals.result = {};

	var limit = config.site.blockTxPageSize;
	var offset = 0;

	if (req.query.limit) {
		limit = parseInt(req.query.limit);

		// for demo sites, limit page sizes
		if (config.demoSite && limit > config.site.blockTxPageSize) {
			limit = config.site.blockTxPageSize;

			res.locals.userMessage = "Transaction page size limited to " + config.site.blockTxPageSize + ". If this is your site, you can change or disable this limit in the site config.";
		}
	}

	if (req.query.offset) {
		offset = parseInt(req.query.offset);
	}

	res.locals.limit = limit;
	res.locals.offset = offset;
	res.locals.paginationBaseUrl = "/block/" + blockHash;

	coreApi.getBlockByHashWithTransactions(blockHash, limit, offset).then(function(result) {
		res.locals.result.getblock = result.getblock;
		res.locals.result.transactions = result.transactions;

		res.render("block");

		next();

	}).catch(function(err) {
		res.locals.userMessage = "Error getting block data";

		res.render("block");

		next();
	});
});

router.get("/tx/:transactionId", function(req, res, next) {
	let txid = req.params.transactionId;

	let output = -1;
	if (req.query.output) {
		output = parseInt(req.query.output);
	}

	res.locals.txid = txid;
	res.locals.output = output;

	res.locals.result = {};

	coreApi.getRawTransaction({query : {txid : txid}}).then(function(rawTxResult) {
		res.locals.result.getrawtransaction = rawTxResult;

		let promises = [];

		promises.push(new Promise(function(resolve, reject) {
			coreApi.getTxUtxos(rawTxResult).then(function(utxos) {
				res.locals.utxos = utxos;
				resolve();

			}).catch(function(err) {
				res.locals.pageErrors.push(utils.logError("3208yhdsghssr", err));

				reject(err);
			});
		}));

		if (rawTxResult.confirmations == null) {
			promises.push(new Promise(function(resolve, reject) {
				coreApi.getMempoolTxDetails(txid).then(function(mempoolDetails) {
					res.locals.mempoolDetails = mempoolDetails;
					resolve();

				}).catch(function(err) {
					res.locals.pageErrors.push(utils.logError("0q83hreuwgd", err));

					reject(err);
				});
			}));
		}
		rawTxResult.vout.forEach(utils.findAddressVout);
		promises.push(new Promise(function(resolve, reject) {
			coreApi.getBlockByHash(rawTxResult.blockhash).then(result3 => {
				res.locals.result.getblock = result3;

				let txidMap = {};
				for (let i = 0; i < rawTxResult.vin.length; i++) {
					let vin = rawTxResult.vin[i];
					if (!vin.coinbase && !vin.address) {
						txidMap[vin.txid] = vin;
					}
				}
				coreApi.getRawTransactions(Object.keys(txidMap)).then(function(txInputs) {
					for(let txInput of txInputs) {
						let vin = txidMap[txInput.txid];
						let inputVout = txInput.vout[vin.vout];
						utils.extractedVinVout(inputVout, vin);
					}
					resolve();
				}).catch(err => {
					res.locals.pageErrors.push(utils.logError("0q83hreuwgd", err));
					reject(err);
				});
				// coreApi.getRawTransactions(txidMap).then(function(txInputs) {
				// 	res.locals.result.txInputs = txInputs;
				// 	resolve();
				// }).catch(err => {
				// 	res.locals.pageErrors.push(utils.logError("0q83hreuwgd", err));
				// 	reject(err);
				// });
			}).catch(err => {
				res.locals.pageErrors.push(utils.logError("0q83hreuwgd", err));
				reject(err);
			});
		}));

		Promise.all(promises).then(function() {
			res.render("transaction");

			next();

		}).catch(function(err) {
			res.locals.pageErrors.push(utils.logError("1237y4ewssgt", err));
			res.locals.message = "Failed to load some part of transaction with txid=" + txid + " and reload may help. error: " + err;

			res.render("error");

			next();
		});


	}).catch(function(err) {
		res.locals.message = "Failed to load transaction with txid=" + txid + ": " + err;

		res.render("error");

		next();
	});
});

routing("/blocktableview/:blockTotal", "get", "renderBlocksTableView", null, true);
routing("/addressview/:address", "get", "renderAddressView", [coins[config.coin].assetSupported, coins[config.coin].hasassets],true);
routing("/address/:address", "get", "renderAddressPage", [coins[config.coin].assetSupported, coins[config.coin].hasassets],true);

router.get("/rpc-terminal", function(req, res, next) {
	if (!config.demoSite && !req.authenticated) {
		res.send("RPC Terminal / Browser require authentication. Set an authentication password via the 'BTCEXP_BASIC_AUTH_PASSWORD' environment variable (see .env-sample file for more info).");

		next();

		return;
	}

	res.render("terminal");

	next();
});

router.post("/rpc-terminal", function(req, res, next) {
	if (!config.demoSite && !req.authenticated) {
		res.send("RPC Terminal / Browser require authentication. Set an authentication password via the 'BTCEXP_BASIC_AUTH_PASSWORD' environment variable (see .env-sample file for more info).");

		next();

		return;
	}

	var params = req.body.cmd.trim().split(/\s+/);
	var cmd = params.shift();
	var parsedParams = [];

	params.forEach(function(param, i) {
		if (!isNaN(param)) {
			parsedParams.push(parseInt(param));

		} else {
			parsedParams.push(param);
		}
	});

	if (config.rpcBlacklist.includes(cmd.toLowerCase())) {
		res.write("Sorry, that RPC command is blacklisted. If this is your server, you may allow this command by removing it from the 'rpcBlacklist' setting in config.js.", function() {
			res.end();
		});

		next();

		return;
	}

	global.rpcClientNoTimeout.command([{method:cmd, parameters:parsedParams}], function(err, result, resHeaders) {
		debugLog("Result[1]: " + JSON.stringify(result, null, 4));
		debugLog("Error[2]: " + JSON.stringify(err, null, 4));
		debugLog("Headers[3]: " + JSON.stringify(resHeaders, null, 4));

		if (err) {
			debugLog(JSON.stringify(err, null, 4));

			res.write(JSON.stringify(err, null, 4), function() {
				res.end();
			});

			next();

		} else if (result) {
			res.write(JSON.stringify(result, null, 4), function() {
				res.end();
			});

			next();

		} else {
			res.write(JSON.stringify({"Error":"No response from node"}, null, 4), function() {
				res.end();
			});

			next();
		}
	});
});

router.get("/rpc-browser", function(req, res, next) {
	if (!config.demoSite && !req.authenticated) {
		res.send("RPC Terminal / Browser require authentication. Set an authentication password via the 'BTCEXP_BASIC_AUTH_PASSWORD' environment variable (see .env-sample file for more info).");

		next();

		return;
	}

	coreApi.getHelp().then(function(result) {
		res.locals.gethelp = result;

		if (req.query.method) {
			res.locals.method = req.query.method;

			coreApi.getRpcMethodHelp(req.query.method.trim()).then(function(result2) {
				res.locals.methodhelp = result2;

				if (req.query.execute) {
					var argDetails = result2.args;
					var argValues = [];

					if (req.query.args) {
						for (var i = 0; i < req.query.args.length; i++) {
							var argProperties = argDetails[i].properties;

							for (var j = 0; j < argProperties.length; j++) {
								if (argProperties[j] === "numeric") {
									if (req.query.args[i] == null || req.query.args[i] == "") {
										argValues.push(null);

									} else {
										argValues.push(parseInt(req.query.args[i]));
									}

									break;

								} else if (argProperties[j] === "boolean") {
									if (req.query.args[i]) {
										argValues.push(req.query.args[i] == "true");
									}

									break;

								} else if (argProperties[j] === "string" || argProperties[j] === "numeric or string" || argProperties[j] === "string or numeric") {
									if (req.query.args[i]) {
										argValues.push(req.query.args[i]);
									}

									break;

								} else if (argProperties[j] === "array") {
									if (req.query.args[i]) {
										argValues.push(JSON.parse(req.query.args[i]));
									}

									break;

								} else {
									debugLog(`Unknown argument property: ${argProperties[j]}`);
								}
							}
						}
					}

					res.locals.argValues = argValues;

					if (config.rpcBlacklist.includes(req.query.method.toLowerCase())) {
						res.locals.methodResult = "Sorry, that RPC command is blacklisted. If this is your server, you may allow this command by removing it from the 'rpcBlacklist' setting in config.js.";

						res.render("browser");

						next();

						return;
					}

					forceCsrf(req, res, err => {
						if (err) {
							return next(err);
						}

						debugLog("Executing RPC '" + req.query.method + "' with params: [" + argValues + "]");

						global.rpcClientNoTimeout.command([{method:req.query.method, parameters:argValues}], function(err3, result3, resHeaders3) {
							debugLog("RPC Response: err=" + err3 + ", result=" + result3 + ", headers=" + resHeaders3);

							if (err3) {
								res.locals.pageErrors.push(utils.logError("23roewuhfdghe", err3, {method:req.query.method, params:argValues, result:result3, headers:resHeaders3}));

								if (result3) {
									res.locals.methodResult = {error:("" + err3), result:result3};

								} else {
									res.locals.methodResult = {error:("" + err3)};
								}
							} else if (result3) {
								res.locals.methodResult = result3;

							} else {
								res.locals.methodResult = {"Error":"No response from node."};
							}

							res.render("browser");

							next();
						});
					});
				} else {
					res.render("browser");

					next();
				}
			}).catch(function(err) {
				res.locals.message = "Error loading help content for method " + req.query.method + ": " + err;

				res.render("error");

				next();
			});

		} else {
			res.render("browser");

			next();
		}

	}).catch(function(err) {
		res.locals.userMessage = "Error loading help content: " + err;

		res.render("browser");

		next();
	});
});

router.get("/unconfirmed-tx", function(req, res, next) {
	var limit = config.site.browseBlocksPageSize;
	var offset = 0;
	var sort = "desc";

	if (req.query.limit) {
		limit = parseInt(req.query.limit);
	}

	if (req.query.offset) {
		offset = parseInt(req.query.offset);
	}

	if (req.query.sort) {
		sort = req.query.sort;
	}

	res.locals.limit = limit;
	res.locals.offset = offset;
	res.locals.sort = sort;
	res.locals.paginationBaseUrl = "/unconfirmed-tx";

	coreApi.getMempoolDetails(offset, limit).then(function(mempoolDetails) {
		res.locals.mempoolDetails = mempoolDetails;

		res.render("unconfirmed-transactions");

		next();

	}).catch(function(err) {
		res.locals.userMessage = "Error: " + err;

		res.render("unconfirmed-transactions");

		next();
	});
});

router.get("/tx-stats", function(req, res, next) {
	var dataPoints = 100;

	if (req.query.dataPoints) {
		dataPoints = req.query.dataPoints;
	}

	if (dataPoints > 250) {
		dataPoints = 250;
	}

	var targetBlocksPerDay = 24 * 60 * 60 / global.coinConfig.targetBlockTimeSeconds;

	coreApi.getTxCountStats(dataPoints, 0, "latest").then(function(result) {
		res.locals.getblockchaininfo = result.getblockchaininfo;
		res.locals.txStats = result.txCountStats;

		coreApi.getTxCountStats(targetBlocksPerDay / 4, -144, "latest").then(function(result2) {
			res.locals.txStatsDay = result2.txCountStats;

			coreApi.getTxCountStats(targetBlocksPerDay / 4, -144 * 7, "latest").then(function(result3) {
				res.locals.txStatsWeek = result3.txCountStats;

				coreApi.getTxCountStats(targetBlocksPerDay / 4, -144 * 30, "latest").then(function(result4) {
					res.locals.txStatsMonth = result4.txCountStats;

					res.render("tx-stats");

					next();
				});
			});
		});
	});
});

router.get("/about", function(req, res, next) {
	res.render("about");

	next();
});

router.get("/changelog", function(req, res, next) {
	res.locals.changelogHtml = marked.parse(global.changelogMarkdown);

	res.render("changelog");

	next();
});

router.get("/fun", function(req, res, next) {
	var sortedList = coins[config.coin].historicalData;
	sortedList.sort(function(a, b){
		return ((a.date > b.date) ? 1 : -1);
	});

	res.locals.historicalData = sortedList;

	res.render("fun");

	next();
});
routing("/ext/summary", "get", "getNetworkSummary", null, false);
module.exports = router;
