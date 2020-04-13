import logger from "consola";
import fs from "fs";
import moment from "moment";
import puppeteer from "puppeteer";
import Pushover from "pushover-notifications";
import Hjson from "hjson";
import { Item } from "types";
import dotenv from "dotenv";
import { Amazon, Bestbuy, Target, Walmart, CoreHomeFitness, DicksSportingGoods } from "./retailers";

const LOOP_DELAY = 1 * 60 * 1000; // 1 minute
const NAV_DELAY = 1 * 1000; // 1 second

dotenv.config();
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

const itemsPath = "./items.hjson";
let items: Item[];
if (fs.existsSync(itemsPath)) {
  items = Hjson.parse(fs.readFileSync(itemsPath).toString()).items;
  console.info(`Loaded ${items.length} items to monitor`);
} else {
  logger.error("Items list missing: ", itemsPath);
  process.exit(1);
}

const foundDbPath = "./found.db.json";
let foundDb: FoundDB = {};
if (fs.existsSync(foundDbPath)) {
  logger.info(`${foundDbPath} exists; loading`);
  foundDb = JSON.parse(fs.readFileSync(foundDbPath).toString());
}

let retailers = [
  new Amazon(),
  new Walmart(),
  new Target(),
  new Bestbuy(),
  new CoreHomeFitness(),
  new DicksSportingGoods(),
];

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

  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36"
  );

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
          try {
            available = await retailer.checkItem(page, item);
          } catch (error) {
            logger.error(`Failed to check '${item.name}':`, error);
          }
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

runLoop().then(() => {
  let timerId = setTimeout(async function request() {
    await runLoop();

    timerId = setTimeout(request, LOOP_DELAY);
  }, LOOP_DELAY);
});
