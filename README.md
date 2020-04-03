# Bungholio

Monitors Amazon and sends a text when watched products (like TP) become available. It will send a Pushover notification at most once per day per product.

**Note**

Requires a Pushover account.

## Installation

1. Clone this repo.
2. `npm install` or `yarn install`
3. Modify items.json with the name and url of products you want to watch.
4. Create a .env file with the following Pushover attributes

```
PUSHOVER_USER=[your user token]
PUSHOVER_TOKEN=[your app token]
```

5. Run it

```
   yarn start
```
