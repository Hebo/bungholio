const readline = require("readline");
const puppeteer = require("puppeteer");

const DEBUG_PAGE = "https://www.bestbuy.com/site/ring-fit-adventure-nintendo-switch/6352149.p?acampID=633495&irclickid=zqHS6VXL%3AxyJWq90EHQlB1XYUkix2LX1MzN9Q40&irgwc=1&loc=zqHS6VXL%3AxyJWq90EHQlB1XYUkix2LX1MzN9Q40&mpid=118528&ref=198&skuId=6352149";

let page;

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on("keypress", (str, key) => {
  if (key.ctrl && key.name === "c") {
    process.exit();
  } else {
    page.screenshot({ path: "example.png" });
    console.log("Screenshot snapped!")
  }
});
console.log("Press any key to take a screenshot...");

async function run() {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    // headless: true,
    headless: false,
  });

  page = await browser.newPage();

  // await page.setUserAgent(
  //   "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36"
  // );
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36"
  );

  await page.setViewport({
    width: 1680,
    height: 1050,
  });

  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

  page.goto(DEBUG_PAGE);
  //  await page.screenshot({path: 'example.png'})
  await Promise.race([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.waitForNavigation({ waitUntil: "load" }),
  ]);
  console.log("done");
  //  await page.evaluate(() => console.log(`url is ${location.href}`));
}

run();
