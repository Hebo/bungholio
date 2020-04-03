const puppeteer = require("puppeteer");
const fs = require("fs");
const moment = require("moment");
const Pushover = require("pushover-notifications");

require("dotenv").config();

const LOOP_DELAY = 3 * 60 * 1000; // 3 minutes
const NAV_DELAY = 3 * 1000; // 3 seconds

const pusher = new Pushover({
  user: process.env["PUSHOVER_USER"],
  token: process.env["PUSHOVER_TOKEN"]
});

const items = require("./items").items;

const foundDbPath = "./found_db.json";
let foundDb = {};

if (fs.existsSync(foundDbPath)) {
  console.info(`${foundDbPath} exists; loading`);
  foundDb = require(foundDbPath);
}

async function checkItem(page, item) {
  console.log(`Checking ${item.name}`);
  await page.goto(item.url);

  const canAdd = await page.$("#add-to-cart-button");
  const notInStock = (await page.content()).match(/in stock on/gi);

  return canAdd && !notInStock;
}

async function sendNotification(item) {
  pusher.send(
    {
      message: `${item.name} available ➡️ ${item.url}`,
      title: "😄" + item.name + " available "
    },
    function(err, result) {
      if (err) {
        console.error("Failed to deliver notification: ", err);
        return;
      }

      console.log("Notification delivered: ", result);
    }
  );
}

async function runChecks() {
  const browser = await puppeteer.launch();

  const page = await browser.newPage();

  await page.setViewport({
    width: 1680,
    height: 1050
  });

  for (const item of items) {
    const oneDayAgo = moment().subtract(1, "days");
    if (!foundDb[item.name] || moment(foundDb[item.name]).isBefore(oneDayAgo)) {
      const available = await checkItem(page, item);

      if (available) {
        foundDb[item.name] = moment().toISOString();
        console.log(`Item '${item.name}' is available.`);
        await sendNotification(item);
      } else {
        console.log(`Item '${item.name}' is not available. `);
      }
      console.log(`Waiting ${NAV_DELAY / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, NAV_DELAY));
    } else {
      console.log(`Item '${item.name}' found recently, skipping check`);
    }
  }

  console.log("finishing...");
  fs.writeFileSync(foundDbPath, JSON.stringify(foundDb, null, 4));
  await browser.close();
  console.log("browser closed");
  return;
}

const runLoop = async () => {
  console.log(`\nStarting at ${moment().toISOString()}`);
  await runChecks();
  console.log(`Next run in ${LOOP_DELAY / 1000} seconds`);
};

runLoop();
let timerId = setTimeout(async function request() {
  await runLoop();

  timerId = setTimeout(request, LOOP_DELAY);
}, LOOP_DELAY);
