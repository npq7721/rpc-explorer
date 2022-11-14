var redis = require("redis");
var bluebird = require("bluebird");

var config = require("./config.js");
var utils = require("./utils.js");

var redisClient = null;
if (config.redisUrl) {
	//bluebird.promisifyAll(redis.RedisClient.prototype);

	redisClient = redis.createClient({url:config.redisUrl});
	redisClient.connect().then(() => {
	}).catch(err => {
		utils.logError("328rhwefghsdgsdss", err, {})
	})
	redisClient.on("error", (err) => {
		console.error("redis encounter an error ", err);
	})
}

function onCacheEvent(cacheType, hitOrMiss, cacheKey) {
	//console.log(`cache.${cacheType}.${hitOrMiss}: ${cacheKey}`);
}

var redisCache = {
	get:function(key) {
		return new Promise(function(resolve, reject) {
			redisClient.get(key).then(function(result) {
				if (result == null) {
					onCacheEvent("redis", "miss", key);

					resolve(null);

					return;
				}

				onCacheEvent("redis", "hit", key);

				resolve(JSON.parse(result));

			}).catch(function(err) {
				utils.logError("328rhwefghsdgsdss", err);

				reject(err);
			});
		});
	},
	set:function(key, obj, maxAgeMillis) {
		redisClient.set(key, JSON.stringify(obj), "PX", maxAgeMillis);
		redisClient.expire(key, maxAgeMillis/1000);
		// redisCache.set(key, JSON.stringify(obj), {
		// 	PX : maxAgeMillis,
		// 	NX : true
		// })
	}
};

module.exports = {
	active: (redisClient != null),
	get: redisCache.get,
	set: redisCache.set
}