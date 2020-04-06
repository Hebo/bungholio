import puppeteer from "puppeteer";
import fs from "fs";
import moment from "moment";
import Pushover from "pushover-notifications";
import { Item } from "types";
import { Amazon, Walmart, Target } from "./retailers";
import logger from "consola";

require("dotenv").config();

const LOOP_DELAY = 3 * 60 * 1000; // 3 minutes
const NAV_DELAY = 3 * 1000; // 3 seconds

if (!process.env["PUSHOVER_USER"] || !process.env["PUSHOVER_TOKEN"]) {
  throw new Error(
    "Environment variables PUSHOVER_USER and PUSHOVER_TOKEN are required"
  );
}

const pusher = new Pushover({
  user: process.env["PUSHOVER_USER"],
  token: process.env["PUSHOVER_TOKEN"],
});

interface FoundDB {
  [index: string]: string;
}

const items: Item[] = require("../items").items;

const foundDbPath = "./found.db.json";
let foundDb: FoundDB = {};
if (fs.existsSync(foundDbPath)) {
  logger.info(`${foundDbPath} exists; loading`);
  foundDb = JSON.parse(fs.readFileSync(foundDbPath).toString());
}

let retailers = [new Amazon(), new Walmart(), new Target()];

async function sendNotification(item: Item) {
  pusher.send(
    {
      message: `${item.name} available ➡️ ${item.url}`,
      title: "😄" + item.name + " available ",
    },
    function (err: Error, result: any) {
      if (err) {
        logger.error("Failed to deliver notification: ", err);
        return;
      }

      logger.log("Notification delivered: ", result);
    }
  );
}

async function runChecks() {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: 1680,
    height: 1050,
  });

  for (const item of items) {
    const oneDayAgo = moment().subtract(1, "days");
    if (!foundDb[item.name] || moment(foundDb[item.name]).isBefore(oneDayAgo)) {
      logger.log(`Checking ${item.name}`);
      let available = false;
      let matched = false;

      for (let retailer of retailers) {
        if (retailer.matchURL(item.url)) {
          matched = true;
          logger.log("Processing with " + retailer.name);
          available = await retailer.checkItem(page, item);
          break;
        }
      }
      if (!matched) {
        logger.log(`No retailer found for URL '${item.url}'`);
      }

      if (available) {
        foundDb[item.name] = moment().toISOString();
        logger.success(`Item '${item.name}' is available.`);
        await sendNotification(item);
      } else {
        logger.log(`Item '${item.name}' is not available. `);
      }
      logger.log(`Waiting ${NAV_DELAY / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, NAV_DELAY));
    } else {
      logger.log(`Item '${item.name}' found recently, skipping check`);
    }
  }

  logger.log("finishing...");
  fs.writeFileSync(foundDbPath, JSON.stringify(foundDb, null, 4));
  await browser.close();
  logger.log("browser closed");
  return;
}

const runLoop = async () => {
  logger.info(`Starting at ${moment().toISOString()}`);
  await runChecks();
  logger.log(`Next run in ${LOOP_DELAY / 1000} seconds`);
};

runLoop();
let timerId = setTimeout(async function request() {
  await runLoop();

  timerId = setTimeout(request, LOOP_DELAY);
}, LOOP_DELAY);
