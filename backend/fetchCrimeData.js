/**
 * @author Gehna Anand
 */
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
const objectHash = require("object-hash");
const MongoClient = require("mongodb").MongoClient;

const ResponseStatus = require("./ResponseStatus");
const Response = require("./Response");
const ResponseUtils = require("./ResponseUtils");
const {
  initializeRedisClient,
  readData,
  writeData,
} = require("./src/middleware/redis");
const { insertDataFromCSV } = require("./src/database/mongoDB");

const app = express();
const dbname = "safemap";
app.use(cors());
const port = 3000;

app.use(bodyParser.json());

class FetchCrimePostBody {
  constructor(latitude, longitude, radius = 0.02) {
    this.latitude = latitude;
    this.longitude = longitude;
    this.radius = radius;
  }
}

console.log("Setting up API for post");
app.post("/fetchCrimeData", async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.body;

    if (!latitude || !longitude) {
      ResponseUtils.setResponseError(
        res,
        400,
        "Latitude and longitude are required",
      );
      return;
    }

    const userLocation = new FetchCrimePostBody(latitude, longitude, radius);

    const cacheKey = objectHash.sha1([
      userLocation.latitude,
      userLocation.longitude,
      userLocation.radius,
    ]);
    console.log("Cached key" + cacheKey);
    cachedValue = await readData(cacheKey);
    console.log("Cached value found: " + cachedValue);
    if (cachedValue) {
      // No need to call API as we have values in cache and can skip it.
      const responseStatus = new ResponseStatus(200, "OK", "Success");
      res.json(new Response(cachedValue, responseStatus));
      return;
    }

    const apiUrl =
      "https://spotcrime.com/map?lat=${userLocation.latitude}&lon=${userLocation.longitude}";
    const response = await axios.get(apiUrl);

    if (response.status == 200) {
      console.log("Success in fetching key");
      const key = response.data.split("data-api-key=")[1].split('"')[1];
      const crimeDataResponse = await axios.get(
        `https://spotcrime.com/crimes.json?lat=${userLocation.latitude}&lon=${userLocation.longitude}&radius=${userLocation.radius}`,
        {
          headers: { "spotcrime-api-token": key },
        },
      );
      if (crimeDataResponse.status == 200) {
        const responseStatus = new ResponseStatus(200, "OK", "Success");

        console.log(
          "Saving in cache" +
            cacheKey +
            ", value= " +
            crimeDataResponse.data.crimes,
        );
        writeData(cacheKey, crimeDataResponse.data.crimes);
        res.json(new Response(crimeDataResponse.data.crimes, responseStatus));
      } else {
        ResponseUtils.setResponseError(
          res,
          crimeDataResponse.status,
          "Failed to fetch crime data",
        );
      }
    } else {
      console.log("Error in fetching key = ", response.status);
      ResponseUtils.setResponseError(
        res,
        response.status,
        "Failed to fetch api key",
      );
    }
  } catch (error) {
    console.error(`Sever error = ${error}`);
    ResponseUtils.setResponseError(res, 500, "Internal Server Error");
  }
});

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

app.post("/closestCrimeData", async (req, res) => {
  try {
    const routeList = req.body.route_list;
    const client = await MongoClient.connect(process.env.MONGO_DB_CLIENT_URI, {
      useUnifiedTopology: true,
    });
    const db = client.db(dbname);

    const closestCrimeDataList = [];

    const crimeDataCursor = db.collection("boulderCrimeData").find();

    const allCrimeData = await crimeDataCursor.toArray();

    const routeProcessingPromises = routeList.map(async (route) => {
      const closestCrimeData = [];

      for (const [targetLat, targetLong] of route) {
        let closestCrime = null;
        let minDistance = Infinity;

        for (const crime of allCrimeData) {
          const distance = calculateDistance(
            targetLat,
            targetLong,
            crime.latitude,
            crime.longitude,
          );
          if (distance < minDistance) {
            minDistance = distance;
            closestCrime = crime;
          }
        }

        if (closestCrime) {
          closestCrimeData.push({
            latitude: targetLat,
            longitude: targetLong,
            crimeData: closestCrime.crimeData,
          });
        } else {
          closestCrimeData.push({
            message: "No crime data found near this location.",
          });
        }
      }
      closestCrimeDataList.push(closestCrimeData);
    });

    await Promise.all(routeProcessingPromises);
    await client.close();

    const responseStatus = new ResponseStatus(200, "OK", "Success");
    res.json(new Response(closestCrimeDataList, responseStatus));
  } catch (err) {
    console.error(err);
    ResponseUtils.setResponseError(res, 500, "Internal Server Error");
  }
});

app.post("/closestCrimeData1", async (req, res) => {
  try {
    const routeList = req.body.route_list;
    const client = await MongoClient.connect(process.env.MONGO_DB_CLIENT_URI, {
      useUnifiedTopology: true,
    });
    const db = client.db(dbname);

    const closestCrimeDataList = [];
    console.log(routeList);
    for (const route of routeList) {
      const closestCrimeData = [];
      for (const [targetLat, targetLong] of route) {
        let closestCrime = null;
        let minDistance = Infinity;

        // Find the closest crime data in MongoDB
        await db
          .collection("boulderCrimeData")
          .find()
          .forEach((crime) => {
            const distance = calculateDistance(
              targetLat,
              targetLong,
              crime.latitude,
              crime.longitude,
            );
            if (distance < minDistance) {
              minDistance = distance;
              closestCrime = crime;
            }
          });

        if (closestCrime) {
          closestCrimeData.push({
            latitude: targetLat,
            longitude: targetLong,
            crimeData: closestCrime.crimeData,
          });
        } else {
          closestCrimeData.push({
            message: "No crime data found near this location.",
          });
        }
      }
      closestCrimeDataList.push(closestCrimeData);
    }

    client.close();
    console.log("Closing client");
    const responseStatus = new ResponseStatus(200, "OK", "Success");
    res.json(new Response(closestCrimeDataList, responseStatus));
  } catch (err) {
    console.error(err);
    ResponseUtils.setResponseError(res, 500, "Internal Server Error");
  }
});

// app.listen(port, () => {
//   console.log(`Server is running on http://localhost:${port}`);
// });

async function initializeExpressServer() {
  //initialize an Express application
  app.use(express.json());

  await insertDataFromCSV();

  //connect to Redis
  if (process.env.REDIS_URL) {
    await initializeRedisClient();
  }

  // start the server
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

initializeExpressServer()
  .then()
  .catch((e) => console.error(e));
