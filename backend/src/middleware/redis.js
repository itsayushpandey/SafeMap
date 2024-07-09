const objectHash = require("object-hash");
const { createClient } = require("redis");
const zlib = require("zlib");

//initialize redis client
let redisClient = undefined;

async function initializeRedisClient() {
  // read the Redis connection URL from the envs
  let redisURL = process.env.REDIS_URL;
  //let redisURL = 'redis://localhost:6379';
  console.log(redisURL);
  if (redisURL) {
    // create the Redis client object
    redisClient = createClient({ url: redisURL }).on("error", (e) => {
      console.error(`Failed to create Redis Client with error:`, e);
    });
  }
  try {
    // connect to the Redis server
    await redisClient.connect();
    console.log("Connected to redis successfully");
  } catch (e) {
    console.error("Connection to redis failed with error:", e);
  }
}

function requestToKey(req) {
  // build a custom object to use as part of the Redis key
  const reqDataToHash = {
    query: req.query,
    body: req.body,
  };
  // `${req.path}@...` to make it easier to find
  // keys on a Redis client
  return `${req.path}@${objectHash.sha1(reqDataToHash)}`;
}

function isRedisWorking() {
  //verify whether there is an active connection to a Redis Server
  return redisClient?.isOpen;
}

async function writeData(
  key,
  data,
  options = {
    EX: 21600, //6h
  },
  compression = true, // enable compression and decompression by default
) {
  if (isRedisWorking()) {
    console.log("Attempting write in cache, is redis working: " + data);
    let newdata = JSON.stringify(data);
    console.log("New Data", newdata);
    let dataToCache = newdata;
    if (compression) {
      // compress the value with ZLIB to save RAM
      dataToCache = zlib.deflateSync(newdata).toString("base64");
      console.log("Compressed cached is being written :", dataToCache);
    }

    try {
      //write data to th Redis cache
      await redisClient.set(key, dataToCache, options);
    } catch (e) {
      console.error(`Failed to cache data for keys = ${key}`, e);
    }
  }
}

async function readData(key, compressed = true) {
  let cachedValue = undefined;
  if (isRedisWorking()) {
    cachedValue = await redisClient.get(key);
    console.log("Reading the cached value: ", cachedValue);
    if (cachedValue) {
      if (compressed) {
        // decompress the cached value with ZLIB
        console.log("Will return compressed cached value");
        return zlib.inflateSync(Buffer.from(cachedValue, "base64")).toString();
      } else {
        return cachedValue;
      }
    }
  }
  return cachedValue;
}
function redisCaching(key, value) {
  return redisCachingMiddleware(key, value);
}

function redisCachingMiddleware(
  key,
  value,
  options = {
    EX: 21600, //6h
  },
  compression = true, // enable compression and decompression by default
) {
  return async (req, res, next) => {
    if (isRedisWorking()) {
      const key = requestToKey(req);
      // if there is some cached data, retrieve it and return it
      const cachedValue = await readData(key, compression);
      if (cachedValue) {
        try {
          // if it is JSON data, then return it
          return res.json(JSON.parse(cachedValue));
        } catch {
          // if it is not JSON data, then return it
          return res.send(cachedValue);
        }
      } else {
        // override how res.send behaves
        // to introduce the caching logic
        const oldSend = res.send;
        res.send = function (data) {
          // set the function back to avoid the 'double-send' effect
          res.send = oldSend;

          // cache the response only if it is successful
          if (res.statusCode.toString().startsWith("2")) {
            writeData(key, data, options, compression).then();
          }
          return res.send(data);
        };
        // continue to the controller function
        next();
      }
    } else {
      //proceed with no caching
      next();
    }
  };
}
module.exports = { initializeRedisClient, readData, writeData };
