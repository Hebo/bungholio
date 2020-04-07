const readline = require("readline");
const puppeteer = require("puppeteer");

const DEBUG_PAGE =
  "https://www.corehomefitness.com/products/core-home-fitness-adjustable-dumbbell-set";

let page;

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on("keypress", (str, key) => {
  if (key.ctrl && key.name === "c") {
    process.exit();
  } else {
    page.screenshot({ path: "example.png" });
    console.log("Screenshot snapped!");
  }
});
console.log("Press any key to take a screenshot...");

async function run() {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
    // headless: false,
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

  const stock = await page.$("#productDetails");
  const productDetailsRaw = await stock.evaluate(
    (node) => node.dataset.variants
  );
  try {
    const details = JSON.parse(productDetailsRaw);
    const stockQuantity = details[0].qtyInStock;
    if (stockQuantity > 0) {
      console.info(`Product Details: ${details[0].qtyInStock} in stock`);
    }
  } catch (error) {
    console.warn("Failed to parse product details");
  }
}

run();
