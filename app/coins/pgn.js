var Decimal = require("decimal.js");
Decimal8 = Decimal.clone({ precision:8, rounding:8 });
var CoinBase = require("./base.js");
var currencyUnits = [
	{
		type:"native",
		name:"PGN",
		multiplier:1,
		default:true,
		values:["", "pgn", "PGN"],
		decimalPlaces:8
	},
	{
		type:"native",
		name:"mPGN",
		multiplier:1000,
		values:["mpgn"],
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
		name:"pig",
		multiplier:100000000,
		values:["pig", "pigeoshi"],
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

var Pigeoncoin = new CoinBase("Pigeoncoin", "PGN", "pigeoncoin");
Pigeoncoin.addProperties({
	logoUrl:"/img/logo/pgn.svg",
	siteTitle:"Pigeoncoin Explorer",
	siteDescriptionHtml:"<b>PGN Explorer</b> is <a href='https://github.com/npq7721/rpc-explorer). If you run your own [Pigeoncoin Full Node](https://github.com/Pigeoncoin/pigeoncoin/releases), **PGN Explorer** can easily run alongside it, communicating via RPC calls. See the project [ReadMe](https://github.com/npq7721/rpc-explorer) for a list of features and instructions for running.",
	nodeTitle:"Pigeoncoin Full Node",
	nodeUrl:"https://github.com/Pigeoncoin/pigeoncoin/releases",
	demoSiteUrl: "https://btc.chaintools.io",
	miningPoolsConfigUrls:[
		"https://raw.githubusercontent.com/pgncom/Blockchain-Known-Pools/master/pools.json",
		"https://raw.githubusercontent.com/blockchain/Blockchain-Known-Pools/master/pools.json"
	],
	maxBlockWeight: 4000000,
	targetBlockTimeSeconds: 60,
	currencyUnits:currencyUnits,
	currencyUnitsByName:{"PGN":currencyUnits[0], "mPGN":currencyUnits[1], "pits":currencyUnits[2], "pig":currencyUnits[3]},
	baseCurrencyUnit:currencyUnits[3],
	defaultCurrencyUnit:currencyUnits[0],
	//feeSatoshiPerByteBucketMaxima: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 50, 75, 100, 150],
	genesisBlockHash: "000000f049bef9fec0179131874c54c76c0ff59f695db30a4f0da52072c99492",
	genesisCoinbaseTransactionId: "f0cc5f92b11a6655a4939fc239e8bf960cd0453b87b5a0820ab36904279341a5",
	genesisCoinbaseTransaction: {
		"hex": "01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0804ffff001d02fd04ffffffff0100f2052a01000000434104f5eeb2b10c944c6b9fbcfff94c35bdeecd93df977882babc7f3a2cf7f5c81d3b09a68db7f0e04f21de5d4230e75e6dbe7ad16eefe0d4325a62067dc6f369446aac00000000",
		"txid": "f0cc5f92b11a6655a4939fc239e8bf960cd0453b87b5a0820ab36904279341a5",
		"hash": "f0cc5f92b11a6655a4939fc239e8bf960cd0453b87b5a0820ab36904279341a5",
		"size": 204,
		"vsize": 204,
		"version": 1,
		"confirmations":775000,
		"vin": [
			{
				"coinbase": "04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73",
				"sequence": 4294967295
			}
		],
		"vout": [
			{
				"value": 5000,
				"n": 0,
				"scriptPubKey": {
					"asm": "04f5eeb2b10c944c6b9fbcfff94c35bdeecd93df977882babc7f3a2cf7f5c81d3b09a68db7f0e04f21de5d4230e75e6dbe7ad16eefe0d4325a62067dc6f369446a OP_CHECKSIG",
					"hex": "4104f5eeb2b10c944c6b9fbcfff94c35bdeecd93df977882babc7f3a2cf7f5c81d3b09a68db7f0e04f21de5d4230e75e6dbe7ad16eefe0d4325a62067dc6f369446aac",
					"reqSigs": 1,
					"type": "pubkey",
					"addresses": [
						"1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
					]
				}
			}
		],
		"blockhash": "000000f049bef9fec0179131874c54c76c0ff59f695db30a4f0da52072c99492",
		"time": 1521661111,
		"blocktime": 1521661111
	},
	genesisCoinbaseOutputAddressScripthash:"8b01df4e368ea28f8dc0423bcf7a4923e3a12d307c875e47a0cfbf90b5c39161",
	historicalData: [
		{
			type: "blockheight",
			date: "2018-03-21",
			blockHeight: 0,
			blockHash: "000000f049bef9fec0179131874c54c76c0ff59f695db30a4f0da52072c99492",
			summary: "The Pigeoncoin Genesis Block.",
			alertBodyHtml: "This is the first block in the Pigeoncoin blockchain, known as the 'Genesis Block'. This block was mined by Pigeoncoin's creator Luke. You can read more about <a href='https://en.bitcoin.it/wiki/Genesis_block'>the genesis block</a>.",
			referenceUrl: "https://en.bitcoin.it/wiki/Genesis_block"
		},
		{
			type: "tx",
			date: "2018-03-21",
			txid: "f0cc5f92b11a6655a4939fc239e8bf960cd0453b87b5a0820ab36904279341a5",
			summary: "The coinbase transaction of the Genesis Block.",
			alertBodyHtml: "This transaction doesn't really exist! ",
			referenceUrl: "https://github.com/bitcoin/bitcoin/issues/3303"
		}

	],

	relatedSites : [
		{name: "Official Website", url:"https://pigeoncoin.org/", imgUrl:"/img/logo/pgn.svg"},
		{name: "Discord", url:"https://discord.gg/SZcf63h", imgUrl:"/img/logo/discord.svg"},
		{name: "Twitter", url:"https://twitter.com/Pigeoncoin", imgUrl:"/img/logo/twitter.svg"},
		{name: "Offiical Pool", url:"https://pool.pigeoncoin.org/", imgUrl:"/img/logo/pgn.svg"},
		{name: "Github", url:"https://github.com/Pigeoncoin", imgUrl:"/img/logo/github.png"}
	],
	blockRewardFunction:function(blockHeight) {
		var eras = [ new Decimal8(5000) ];
		for (var i = 1; i < 34; i++) {
			var previous = eras[i - 1];
			eras.push(new Decimal8(previous).dividedBy(2));
		}

		var index = Math.floor(blockHeight / 2100000);

		return eras[index];
	}
});

module.exports = Pigeoncoin.properties;
