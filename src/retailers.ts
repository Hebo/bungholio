import puppeteer from "puppeteer";
import logger from "consola";
import { Item } from "types";

interface Retailer {
  name: string;

  checkItem(page: puppeteer.Page, item: Item): Promise<boolean>;
  matchURL(url: string): boolean;
}

export class Retail {
  name: string;
  storeRegex: RegExp;
  constructor(name: string, store: RegExp) {
    this.name = name;
    this.storeRegex = store;
  }

  matchURL(url: string) {
    return this.storeRegex.test(url);
  }
}

export class Amazon extends Retail implements Retailer {
  constructor() {
    super("Amazon", /amazon\.com/);
  }

  async checkItem(page: puppeteer.Page, item: Item) {
    await page.goto(item.url);

    const canAdd = await page.$("#add-to-cart-button");
    const notInStock = (await page.content()).match(/in stock on/gi);

    return !!(canAdd && !notInStock);
  }
}

export class Walmart extends Retail implements Retailer {
  constructor() {
    super("Walmart", /walmart\.com/);
  }

  async checkItem(page: puppeteer.Page, item: Item) {
    await page.goto(item.url);

    const canAdd = await page.$(".prod-product-cta-add-to-cart");
    const notInStock = (await page.content()).match(/Get In-Stock Alert/gi);
    const noDelivery = (await page.content()).match(/Delivery not available/gi);

    return !!(canAdd && !notInStock && !noDelivery);
  }
}

export class Target extends Retail implements Retailer {
  constructor() {
    super("Target", /target\.com/);
  }

  async checkItem(page: puppeteer.Page, item: Item) {
    await page.goto(item.url);

    const canAdd = await page.$("[data-test=shippingATCButton]");
    const notInStock = (await page.content()).match(/Not available/gi);

    return !!(canAdd && !notInStock);
  }
}

export class Bestbuy extends Retail implements Retailer {
  constructor() {
    super("Bestbuy", /bestbuy\.com/);
  }

  async checkItem(page: puppeteer.Page, item: Item) {
    // Bestbuy.com is extremely slow; times out frequently and slows down the rest
    // of the app. Re-enable at your own risk
    logger.warn("Bestbuy handler disabled due to poor site performance");
    return false;

    await page.goto(item.url);

    const canAdd = await page.$(".add-to-cart-button:not(.btn-disabled)");

    const cartBtnContent = (
      await page.$(".fulfillment-add-to-cart-button")
    )?.toString();
    const notInStock = cartBtnContent?.match(/Sold Out/gi);

    return !!(canAdd && !notInStock);
  }
}

export class CoreHomeFitness extends Retail implements Retailer {
  constructor() {
    super("CoreHomeFitness", /corehomefitness\.com/);
  }

  async checkItem(page: puppeteer.Page, item: Item) {
    await page.goto(item.url);

    const productDetailsElement = await page.$("#productDetails");
    const productDetailsRaw = await productDetailsElement?.evaluate(
      (node: any) => node["dataset"].variants
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

    const notInStock = (await page.content()).match(/sold out/gi);

    return !notInStock;
  }
}
