import puppeteer from "puppeteer";
import fs from "fs";
import moment from "moment";
import Pushover from "pushover-notifications";
import { Item } from "types";
import { Amazon, Walmart } from "./retailers";

require("dotenv").config();

const LOOP_DELAY = 3 * 60 * 1000; // 3 minutes
const NAV_DELAY = 3 * 1000; // 3 seconds

const pusher = new Pushover({
  user: process.env["PUSHOVER_USER"],
  token: process.env["PUSHOVER_TOKEN"]
});

interface FoundDB {
  [index: string]: string;
}

const items: Item[] = require("./items").items;

const foundDbPath = "./found.db.json";
let foundDb: FoundDB = {};
if (fs.existsSync(foundDbPath)) {
  console.info(`${foundDbPath} exists; loading`);
  foundDb = JSON.parse(fs.readFileSync(foundDbPath).toString());
}

let amazon = new Amazon();
let walmart = new Walmart();

let retailers = [amazon, walmart];

async function sendNotification(item: Item) {
  pusher.send(
    {
      message: `${item.name} available ➡️ ${item.url}`,
      title: "😄" + item.name + " available "
    },
    function(err: Error, result: any) {
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
      console.log(`Checking ${item.name}`);
      let available = false;
      let matched = false;

      for (let retailer of retailers) {
        if (retailer.matchURL(item.url)) {
          matched = true;
          console.log("Processing with " + retailer.name);
          available = await retailer.checkItem(page, item);
          break;
        }
      }
      if (!matched) {
        console.log(`No retailer found for URL '${item.url}'`);
      }

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
