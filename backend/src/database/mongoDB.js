/**
 * @author Gehna Anand
 */

const { MongoClient } = require("mongodb");
const fs = require("fs");
const csv = require("csv-parser");

const client = new MongoClient(process.env.MONGO_DB_CLIENT_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function connectDB() {
  try {
    if (!client) {
      await client.connect();
      console.log("Connected to MongoDB");
    }
  } catch (err) {
    console.error("Error connecting to MongoDB", err);
    throw err;
  }
}

async function setupIndexes(db, collection) {
  try {
    // Create a unique index on the 'index' field
    await db.collection(collection).createIndex({ index: 1 }, { unique: true });
    // console.log('Unique index created on the "index" field');
  } catch (error) {
    console.error("Error creating index:", error);
    throw error;
  }
}

async function insertDocument(db, index, lat, long) {
  try {
    const result = await db
      .collection("boulderLatLong")
      .insertOne({ index, latitude: lat, longitude: long });
    // console.log(`Inserted document with ID ${result.insertedId}`);
  } catch (error) {
    if (error.code === 11000) {
      // console.log(`Document with index ${index}, latitude ${lat}, and longitude ${long} already exists. Ignoring duplicate.`);
    } else {
      console.error("Error inserting document", error);
      throw error;
    }
  }
}

function isConnected() {
  return !!client && !!client.topology && client.topology.isConnected();
}

async function closeDB() {
  try {
    if (client && isConnected()) {
      await client.close();
      console.log("Disconnected from MongoDB");
    } else {
      console.log("Client is not connected to MongoDB");
    }
  } catch (error) {
    console.error("Error closing MongoDB connection:", error);
  }
}

async function insertDataFromCSV() {
  return new Promise(async (resolve, reject) => {
    try {
      await connectDB();

      const db = client.db("safemap");
      let index = 1;
      const promises = [];

      fs.createReadStream("SafeMap.csv")
        .pipe(csv())
        .on("data", (row) => {
          const wkt = row.WKT;
          const match = wkt.match(/POINT \((-?\d+\.\d+) (-?\d+\.\d+)\)/);
          if (match) {
            const lat = parseFloat(match[2]);
            const long = parseFloat(match[1]);
            promises.push(insertDocument(db, index++, lat, long));
          } else {
            console.error("Invalid format for WKT:", wkt);
          }
        })
        .on("end", () => {
          // Wait for all insertion promises to resolve before resolving this function
          Promise.all(promises).then(() => {
            setupIndexes(db, "boulderLatLong").then(() => {
              console.log("Data insertion completed");
              resolve();
            });
          });
        });
    } catch (err) {
      console.error("Error inserting data from CSV", err);
      reject(err);
    } finally {
      await closeDB();
    }
  });
}

async function waitForInsertionAndRead() {
  try {
    await insertDataFromCSV();
    const documents = await readFromMongoDB();
    return documents;
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await closeDB();
  }
}

async function readFromMongoDB() {
  try {
    await connectDB();
    const db = client.db("safemap");
    const collection = db.collection("boulderLatLong");

    const cursor = collection.find({});
    const documents = [];

    await cursor.forEach((document) => {
      documents.push(document);
    });

    console.log("Data reading completed");

    return documents;
  } catch (error) {
    console.error("Error reading data from MongoDB", error);
  }
}

async function insertCrimeData(index, lat, long, crimeData) {
  try {
    await connectDB();
    const db = client.db("safemap");
    setupIndexes(db, "boulderCrimeData");
    const result = await db
      .collection("boulderCrimeData")
      .insertOne({ index, latitude: lat, longitude: long, crimeData });
  } catch (error) {
    if (error.code === 11000) {
      // console.log(`Document with index ${index}, latitude ${lat}, and longitude ${long} already exists. Ignoring duplicate.`);
    } else {
      console.error("Error inserting crime data into MongoDB", error);
    }
  }
}

module.exports = {
  insertDataFromCSV,
  readFromMongoDB,
  insertCrimeData,
  closeDB,
};
