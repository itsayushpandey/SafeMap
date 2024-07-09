/**
 * @author Gehna Anand
 *
 * Cron job runs every 48hrs. It fetches crime data for specific lat long present in DB
 * and inserts the crime data to DB
 */

const cron = require("cron");
const axios = require("axios");
const {
  readFromMongoDB,
  insertCrimeData,
  closeDB,
} = require("../src/database/mongoDB");

const fetchCrimeData = async () => {
  try {
    const documents = await readFromMongoDB();

    for (const document of documents) {
      const { index, latitude, longitude } = document;
      console.log(`Hit api with ${latitude}, ${longitude}`);

      const radius = 0.02;

      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Wait for 15 minutes after 15 requests
      if (index % 15 == 0)
        await new Promise((resolve) => setTimeout(resolve, 900000));

      // TODO:: Gehna - Change the api url
      const response = await axios.post(
        "http://localhost:3000/fetchCrimeData",
        { latitude, longitude, radius },
      );
      console.log(response.status);
      insertCrimeData(index, latitude, longitude, response.data.data);
    }

    if (documents.length === 0) {
      console.log("No data found in MongoDB.");
    }
  } catch (error) {
    console.error("Error fetching crime data:", error);
  } finally {
    await closeDB();
  }
};

// fetchCrimeData();

// Cron job runs every 48 hrs
const job = new cron.CronJob("0 0 */48 * * *", function () {
  fetchCrimeData();
});

job.start();

console.log("Cron job started.");
