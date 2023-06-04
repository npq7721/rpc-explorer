let unlimittedIps = process.env.UNLIMIT_IPS ? process.env.UNLIMIT_IPS.split(",") : [];
let maxRequestsCount = process.env.BTCEXP_HTTP_REQUEST_LIMIT_COUNT ? process.env.BTCEXP_HTTP_REQUEST_LIMIT_COUNT : 100;
let maxRequestsWindow = process.env.BTCEXP_HTTP_REQUEST_LIMIT_WINDOW ? process.env.BTCEXP_HTTP_REQUEST_LIMIT_WINDOW : 1;
class CoinBase {
	constructor(name, ticker, priceid, satUnits = ["sat", "satoshi"]) {
		this.name = name;
		this.ticker = ticker;
		this.priceid = priceid;
		this.priceApiUrl = `https://api.coingecko.com/api/v3/coins/${priceid}?localization=false`;
		var currencyUnits = [
			{
				type:"native",
				name:ticker,
				multiplier:1,
				default:true,
				values:["", ticker.toLowerCase(), ticker],
				decimalPlaces:8
			},
			{
				type:"native",
				name:"mRTM",
				multiplier:1000,
				values:[`m${ticker.toLowerCase()}`],
				decimalPlaces:5
			},
			{
				type:"native",
				name:"bits",
				multiplier:1000000,
				values:["bits"],
				decimalPlaces:2
			},
			{
				type:"native",
				name:"rap",
				multiplier:100000000,
				values:satUnits,
				decimalPlaces:0
			},
			{
				type:"exchanged",
				name:"BTC",
				multiplier:"btc",
				values:["btc"],
				decimalPlaces:8,
				symbol:"฿"
			},
			{
				type:"exchanged",
				name:"USD",
				multiplier:"usd",
				values:["usd"],
				decimalPlaces:8,
				symbol:"$"
			},
			{
				type:"exchanged",
				name:"CHY",
				multiplier:"cny",
				values:["eur"],
				decimalPlaces:4,
				symbol:"¥"
			},
		];
		this.properties = {
			name : this.name,
			ticker : this.ticker,
			feeSatoshiPerByteBucketMaxima: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 50, 75, 100, 150],
			exchangeRateData:{
				jsonUrl:this.priceApiUrl,
				responseBodySelectorFunction:this.responseBodySelectorFunction
			},
			api : this.coinApi,
			maxBlockWeight: 4000000,
			currencyUnits : currencyUnits,
			baseCurrencyUnit: currencyUnits[3],
			defaultCurrencyUnit: currencyUnits[0],
			tableHeaders : this.tableHeaders()
		};
	}

	addTableHeaders(headers) {
		Object.assign(this.properties.tableHeaders, headers);
	}

	tableHeaders() {
		return {
			transactions_table_headers : [
				{
					name : "TXID"
				},
				{
					name : "Confirmations"
				}
			],
			blocks_table_headers : [
				{
					name : "Height"
				},
				{
					name : "Timestamp"
				},
				{
					name : "Age"
				},
				{
					name : "Miner"
				},
				{
					name : "Transactions"
				},
				{
					name : "Average Fee"
				},
				{
					name : "Size (bytes)"
				}
			],
			rich_list_table_headers : [
				{
					name : "Rank"
				},
				{
					name : "Address"
				},
				{
					name : "Label"
				},
				{
					name : "Balance"
				}
			],
			market_list_table_headers : [
				{
					name : "Exchange"
				},
				{
					name : "Pair"
				},
				{
					name : "Price"
				},
				{
					name : "Volume"
				},
				{
					name : "Change"
				}
			]
		}
	}

	responseBodySelectorFunction(responseBody) {
		var exchangedCurrencies = ["BTC", "USD", "CNY"];

		if (responseBody.market_data) {
			var exchangeRates = {};

			for (var i = 0; i < exchangedCurrencies.length; i++) {
				var currency = exchangedCurrencies[i].toLowerCase();
				if (responseBody.market_data.current_price[currency]) {
					exchangeRates[currency] = responseBody.market_data.current_price[currency];
				}
			}

			return exchangeRates;
		}

		return null;
	}

	coinApi() {
		return {
			base_uri : "/api/",
			limit : {
				windowMs: maxRequestsWindow * 60 * 1000, // 15 minutes
				max: maxRequestsCount, // limit each IP to 100 requests per windowMs
				message: `Too calls from this IP within ${maxRequestsWindow} min, please try again after ${maxRequestsWindow} min. Can't make more then ${maxRequestsCount} requests`,
				keyGenerator : (req, res) => {
					var ip = req.headers['x-forwarded-for'];
					if(!ip) {
						ip = req.ip;
					} else {
						console.log("x-forwarded-for ip", ip);
					}
					return ip;
				},
				skip : (req, res) => {
					var ip = req.headers['x-forwarded-for'];
					if(!ip) {
						ip = req.ip;
					}
					var skip = unlimittedIps.includes(ip);
					if(skip) {
						console.log("ip=%s get unlimitted api requests", ip)
					} else {
						console.log("ip=%s get limitted api requests. %s/%s min ", ip, maxRequestsCount, maxRequestsWindow)
					}
					return skip;
				}
			},
			api_map : [
				{
					name : "getblockcount",
					uri : "getblockcount",
					api_source : "core",
					method : "getBlockCount",
					params : [{
						name : "nocache",
						type : "bool",
						description : "true if get it without cache"
					}],
					description : "Get current block height",
					"return" : "block height as number"
				},
				{
					name : "getblocks",
					uri : "getblocks",
					api_source : "getBlocks",
					method : "getBlocks",
					params : [
						{
							name : "start",
							type : "number",
							description : "Begin row for query result"
						},
						{
							name : "length",
							type : "number",
							description : "max result for the query"
						},
						{
							name : "search.value",
							type: "object",
							description : "block height.Specifc height or start-end. Start can be * which mean start from block 0. End can be * which is end at current height."
						}
					],
					description : "Get current block height",
					"return" : "List of Block information"
				},
				{
					name : "queryrichlist",
					uri : "queryrichlist",
					api_source : "queryRichList",
					method : "queryRichList",
					params : [
						{
							name : "start",
							type : "number",
							description : "Begin row for query result"
						},
						{
							name : "length",
							type : "number",
							description : "max result for the query"
						}
					],
					description : "Query rich list",
					"return" : "List of Wallets with balance in descendants order"
				},
				{
					name : "getnetworkhashes",
					uri : "getnetworkhashes",
					api_source : "getNetworkHashes",
					params : [
						{
							name : "total",
							type : "number",
							description : "total number of blocks to get hashrates starting from certain block or latest block by default"
						},
						{
							name : "from",
							type : "number",
							description : "Optional. default to be current height. Starting blocks to get hashrates data"
						}
					],
					description : "Get hashrates for total of blocks starting from block height",
					"return" : "A map of height and its hashrate"
				},
				{
					name : "getblock",
					uri : "getblock",
					api_source : "core",
					method : "getBlock",
					params : [{
						name : "height",
						type : "number",
						description : "valid block height"
					}],
					description : "Get block information by height",
					"return" : "Json Object of block info in following format: " +
						`<ul><li>{<br>
			  			  &emsp;&emsp;"hash" : "hash",     (string) the block hash (same as provided)<br>
						  &emsp;&emsp;"confirmations" : n,   (numeric) The number of confirmations, or -1 if the block is not on the main chain<br>
						  &emsp;&emsp;"size" : n,            (numeric) The block size<br>
						  &emsp;&emsp;"strippedsize" : n,    (numeric) The block size excluding witness data<br>
						  &emsp;&emsp;"weight" : n           (numeric) The block weight as defined in BIP 141<br>
						  &emsp;&emsp;"height" : n,          (numeric) The block height or index<br>
						  &emsp;&emsp;"version" : n,         (numeric) The block version<br>
						  &emsp;&emsp;"versionHex" : "00000000", (string) The block version formatted in hexadecimal<br>
						  &emsp;&emsp;"merkleroot" : "xxxx", (string) The merkle root<br>
						  &emsp;&emsp;"tx" : [               (array of string) The transaction ids<br>
						  &emsp;&emsp;&emsp;   "transactionid"     (string) The transaction id<br>
						  &emsp;&emsp;&emsp;   ,...<br>
						  &emsp;&emsp;],<br>
						  &emsp;&emsp;"time" : ttt,          (numeric) The block time in seconds since epoch (Jan 1 1970 GMT)<br>
						  &emsp;&emsp;"mediantime" : ttt,    (numeric) The median block time in seconds since epoch (Jan 1 1970 GMT)<br>
						  &emsp;&emsp;"nonce" : n,           (numeric) The nonce<br>
						  &emsp;&emsp;"bits" : "1d00ffff", (string) The bits<br>
						  &emsp;&emsp;"difficulty" : x.xxx,  (numeric) The difficulty<br>
						  &emsp;&emsp;"chainwork" : "xxxx",  (string) Expected number of hashes required to produce the chain up to this block (in hex)<br>
						  &emsp;&emsp;"previousblockhash" : "hash",  (string) The hash of the previous block<br>
						  &emsp;&emsp;"nextblockhash" : "hash"       (string) The hash of the next block<br>
							}</li></ul>`
				},
				{
					name : "getrawtransaction",
					uri : "getrawtransaction",
					api_source : "core",
					method : "getRawTransaction",
					params : [{
						name : "txid",
						type : "string",
						description : "valid transaction id"
					}],
					description : "Get raw detail of a transaction",
					"return" : "Json Object of transaction info in following format: " +
						`<ul><li>{
							  <br>&emsp;&emsp;"hex" : "data",       (string) The serialized, hex-encoded data for 'txid'
							  <br>&emsp;&emsp;"txid" : "id",        (string) The transaction id (same as provided)
							  <br>&emsp;&emsp;"hash" : "id",        (string) The transaction hash (differs from txid for witness transactions)
							  <br>&emsp;&emsp;"size" : n,             (numeric) The serialized transaction size
							  <br>&emsp;&emsp;"vsize" : n,            (numeric) The virtual transaction size (differs from size for witness transactions)
							  <br>&emsp;&emsp;"version" : n,          (numeric) The version
							  <br>&emsp;&emsp;"locktime" : ttt,       (numeric) The lock time
							  <br>&emsp;&emsp;"vin" : [               (array of json objects)
							  <br>&emsp;&emsp;&emsp;   {
							  <br>&emsp;&emsp;&emsp;&emsp;     "txid": "id",    (string) The transaction id
							  <br>&emsp;&emsp;&emsp;&emsp;     "vout": n,         (numeric)
							  <br>&emsp;&emsp;&emsp;&emsp;     "scriptSig": {     (json object) The script
							  <br>&emsp;&emsp;&emsp;&emsp;&emsp;       "asm": "asm",  (string) asm
							  <br>&emsp;&emsp;&emsp;&emsp;&emsp;      "hex": "hex"   (string) hex
							  <br>&emsp;&emsp;&emsp;&emsp;    },
							  <br>&emsp;&emsp;&emsp;&emsp;     "sequence": n      (numeric) The script sequence number
							  <br>&emsp;&emsp;&emsp;&emsp;     "txinwitness": ["hex", ...] (array of string) hex-encoded witness data (if any)
							  <br>&emsp;&emsp;&emsp;   }
							  <br>&emsp;&emsp;&emsp;   ,...
							  <br>&emsp;&emsp;],
							  <br>&emsp;&emsp;"vout" : [              (array of json objects)
							  <br>&emsp;&emsp;&emsp;   {
							  <br>&emsp;&emsp;&emsp;&emsp;     "value" : x.xxx,            (numeric) The value whole unit
							  <br>&emsp;&emsp;&emsp;&emsp;     "n" : n,                    (numeric) index
							  <br>&emsp;&emsp;&emsp;&emsp;     "scriptPubKey" : {          (json object)
							  <br>&emsp;&emsp;&emsp;&emsp;&emsp;       "asm" : "asm",          (string) the asm
							   <br>&emsp;&emsp;&emsp;&emsp;&emsp;      "hex" : "hex",          (string) the hex
							  <br>&emsp;&emsp;&emsp;&emsp;&emsp;       "reqSigs" : n,            (numeric) The required sigs
							  <br>&emsp;&emsp;&emsp;&emsp;&emsp;       "type" : "pubkeyhash",  (string) The type, eg 'pubkeyhash'
							  <br>&emsp;&emsp;&emsp;&emsp;&emsp;       "addresses" : [           (json array of string)
							  <br>&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;         "address"        (string) pigeon address
							  <br>&emsp;&emsp;&emsp;&emsp;&emsp;        ,...
							  <br>&emsp;&emsp;&emsp;&emsp;&emsp;      ]
							  <br>&emsp;&emsp;&emsp;&emsp;     }
							  <br>&emsp;&emsp;&emsp;   }
							  <br>&emsp;&emsp;&emsp;   ,...
							  <br>&emsp;&emsp;],
							  <br>&emsp;&emsp;"blockhash" : "hash",   (string) the block hash
							  <br>&emsp;&emsp;"confirmations" : n,      (numeric) The confirmations
							  <br>&emsp;&emsp;"time" : ttt,             (numeric) The transaction time in seconds since epoch (Jan 1 1970 GMT)
							  <br>&emsp;&emsp;"blocktime" : ttt         (numeric) The block time in seconds since epoch (Jan 1 1970 GMT)
							<br>}</li></ul>`
				},
				{
					name : "getaddressbalance",
					uri : "getaddressbalance",
					api_source : "getAddressBalance",
					params : [{
						name : "address",
						type : "string",
						description : "public wallet address"
					}],
					description : "Get current balance for specified address",
					"return" : "Json Object of address balance in following format: " +
						"<ul><li>{ 'address' : <br>" +
						"&emsp;{ 'confirmed' : satoshi_amount, <br>" +
						"&emsp;&nbsp;&nbsp;'unconfirmed' : satoshi_amount }<br>}</li></ul>"
				},
				{
					name : "getaddressutxos",
					uri : "getaddressutxos",
					api_source : "getAddressUTXOs",
					params : [{
						name : "address",
						type : "string",
						description : "public wallet address"
					}],
					description : "Get list of unspent transactions meta data for specified address",
					"return" : "Json Object of address utxo in following format: " +
						"<ul><li>{ 'address' : <br>" +
						"&emsp;&emsp;[<br>" +
						"&emsp;&emsp;&nbsp;&nbsp;{ 'tx_hash' : txid, <br>" +
						"&emsp;&emsp;&nbsp;&nbsp;&nbsp;&nbsp;'tx_pos' : index, <br>" +
						"&emsp;&emsp;&nbsp;&nbsp;&nbsp;&nbsp;'height' : block_height, <br>" +
						"&emsp;&emsp;&nbsp;&nbsp;&nbsp;&nbsp;'value' : satoshi_amount }, <br>" +
						"&emsp;&emsp;... ]<br>" +
						"}</li></ul>"
				},
				{
					name : "getmininginfo",
					uri : "getmininginfo",
					api_source : "core",
					method : "getMiningInfo",
					description : "Get current network mining information",
					"return" : "JSON object in the following format: " +
						`<ul><li>{
						  <br>&emsp;&emsp;"blocks": nnn,             (numeric) The current block
						  <br>&emsp;&emsp;"currentblockweight": nnn, (numeric) The last block weight
						  <br>&emsp;&emsp;"currentblocktx": nnn,     (numeric) The last block transaction
						  <br>&emsp;&emsp;"difficulty": xxx.xxxxx    (numeric) The current difficulty
						  <br>&emsp;&emsp;"networkhashps": nnn,      (numeric) The network hashes per second
						  <br>&emsp;&emsp;"hashespersec": nnn,       (numeric) The hashes per second of built-in miner
						  <br>&emsp;&emsp;"pooledtx": n              (numeric) The size of the mempool
						  <br>&emsp;&emsp;"chain": "xxxx",           (string) current network name as defined in BIP70 (main, test, regtest)
						  <br>&emsp;&emsp;"warnings": "..."          (string) any network and blockchain warnings
						  <br>}</li><ul>`
				},
				{
					name : "supply",
					uri : "supply",
					api_source : "core",
					method : "getSupply",
					description : "Get current supply",
					"return" : "current coin supply as number"
				},
				{
					name : "marketcap",
					uri : "marketcap",
					api_source : "core",
					method : "getMarketCap",
					description : "Get current market cap",
					"return" : "current coin market cap ฿ value / $ value. i.e ฿1/$4400"
				},
				{
					name : "broadcast",
					uri : "broadcast",
					api_source : "core",
					method : "broadcast",
					params : [{
						name : "tx",
						type : "string",
						description : "raw transaction in hex"
					}],
					description : "broadcast transaction",
					"return" : "txid"
				},
				{
					name : "getlatesttxids",
					uri : "getlatesttxids",
					api_source : "getLatestTxids",
					params : [{
						name : "blocks",
						type : "number",
						description : "Number of latest blocks to get transactions from"
					}],
					description : "Get all transactions from the last x blocks",
					"return" : "JSON object in the following format: " +
						`<ul><li>{
						  <br>&emsp;&emsp;"data": array of txids object
						  <br>&emsp;&emsp;"columns": an column maping array to be use for jquery data table
						  <br>}</li><ul>`
				}
			]
		}
	}

	addProperties(properties) {
		Object.assign(this.properties, properties);
	}
}

module.exports = CoinBase;
