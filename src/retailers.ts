import puppeteer from "puppeteer";
import { Item } from "types";

interface Retailer {
  name: string;

  checkItem(page: puppeteer.Page, item: Item): Promise<boolean>;
  matchURL(url: string): boolean;
}

export class Retail {}

export class Amazon extends Retail implements Retailer {
  name: string;
  constructor() {
    super();
    this.name = "Amazon";
  }

  async checkItem(page: puppeteer.Page, item: Item) {
    await page.goto(item.url);

    const canAdd = await page.$("#add-to-cart-button");
    const notInStock = (await page.content()).match(/in stock on/gi);

    return !!(canAdd && !notInStock);
  }

  matchURL(url: string) {
    return /amazon\.com/.test(url);
  }
}

export class Walmart extends Retail implements Retailer {
  name: string;

  constructor() {
    super();
    this.name = "Walmart";
  }

  async checkItem(page: puppeteer.Page, item: Item) {
    await page.goto(item.url);

    const canAdd = await page.$(".prod-product-cta-add-to-cart");
    const notInStock = (await page.content()).match(/Get In-Stock Alert/gi);

    return !!(canAdd && !notInStock);
  }

  matchURL(url: string) {
    return /walmart\.com/.test(url);
  }
}
