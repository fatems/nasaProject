const { default: axios } = require("axios");
const launchesDatabase = require("./launches.mongo");
const planets = require("./planets.mongo");

const launches = new Map();

// let latestFlightNumber = 100;
const DEFAULT_FLIGHT_NUMBER = 100;

const launch = {
  flightNumber: 100, //flight_number
  mission: "Kepler Exploration X", //name
  rocket: "Explorer IS1", //exists under rocket.name
  launchDate: new Date("December 27, 2030"), //date_local
  target: "Kepler-442 b", //not applicable
  customers: ["ZTM", "NASA"], //payloads.customers  for each payload
  upcoming: true, //upcoming
  success: true, //success
};

// launches.set(launch.flightNumber, launch);
saveLaunch(launch);

const SPACEX_API_URL = "https://api.spacexdata.com/v4/launches/query";

async function populateLaunches(){
  console.log("Downloading launch data...");
  const response = await axios.post(SPACEX_API_URL, {
    query: {},
    options: {
      pagination: false,
      populate: [
        {
          path: "rocket",
          select: {
            name: 1,
          },
        },
        {
          path: "payloads",
          select: {
            customers: 1,
          },
        },
      ],
    },
  });
  if(response.status != 200){
    console.log('Problem downloading SpaceX launches data');
    throw new Error('SpaceX Launch data download failed!');
  }
  const launchDocs = response.data.docs;
  for (const launchDoc of launchDocs) {
    const payloads = launchDoc["payloads"];
    const customers = payloads.flatMap((payload) => {
      return payload["customers"];
    });
    const launch = {
      flightNumber: launchDoc["flight_number"],
      mission: launchDoc["name"],
      rocket: launchDoc["rocket"]["name"],
      launchDate: launchDoc["date_local"],
      upcoming: launchDoc["upcoming"],
      success: launchDoc["success"],
      customers,
    };

    console.log(`${launch.flightNumber} ${launch.mission}`);

    //TODO: populate launches collection to database.

    await saveLaunch(launch);
  }
}

async function loadLaunchesData() {
  const firstLaunch = await findLaunch({
    flightNumber: 1,
    rocket: "Falcon 1",
    mission: "FalconSat",
  });
  if(firstLaunch){
    console.log('Launch data already exist.');
  }
  else{
    await populateLaunches();
  }
  
}

async function getAllLaunches(skip, limit) {
  //   return Array.from(launches.values());
  return await launchesDatabase.find({}, { __v: 0, _id: 0 })
  .sort({flightNumber: 1})
  .skip(skip)
  .limit(limit);
}

async function saveLaunch(launch) {
  

  await launchesDatabase.findOneAndUpdate(
    { flightNumber: launch.flightNumber },
    launch,
    { upsert: true }
  );
}

// function addNewLaunch(launch) {
//   latestFlightNumber++;
//   launches.set(
//     latestFlightNumber,
//     Object.assign(launch, {
//       flightNumber: latestFlightNumber,
//       cutomers: ["Zero to Mastery", "NASA"],
//       upcoming: true,
//       success: true,
//     })
//   );
// }

async function getLatestFlightNumber() {
  const latestLaunch = await launchesDatabase.findOne().sort("-flightNumber");
  if (!latestLaunch) {
    return DEFAULT_FLIGHT_NUMBER;
  }
  return latestLaunch.flightNumber;
}

async function scheduleNewLaunch(launch) {
  const planet = await planets.findOne({ keplerName: launch.target });

  if (!planet) {
    throw new Error("No matching planet was found!");
  }
  const newFlightNum = (await getLatestFlightNumber()) + 1;
  console.log("hyyy" + newFlightNum);
  //   console.log(flightNum);
  const newLaunch = Object.assign(launch, {
    flightNumber: newFlightNum,
    upcoming: true,
    success: true,
    customers: ["Zero to Mastery", "NASA"],
  });
  await saveLaunch(newLaunch);
}

async function findLaunch(filter) {
  return await launchesDatabase.findOne(filter);
}

async function existsLaunchById(launchId) {
  // return launches.has(launchId);
  return await findLaunch({ flightNumber: launchId });
}

async function abortLaunchById(launchId) {
  // const aborted = launches.get(launchId);
  // aborted.upcoming = false;
  // aborted.success = false;
  // return aborted;

  const aborted = await launchesDatabase.updateOne(
    { flightNumber: launchId },
    { success: false, upcoming: false }
  );
  console.log(aborted);
  console.log(aborted.ok);
  return aborted.acknowledged === true && aborted.modifiedCount === 1;
  // return aborted;
}

module.exports = {
  loadLaunchesData,
  getAllLaunches,
  scheduleNewLaunch,
  existsLaunchById,
  abortLaunchById,
};
