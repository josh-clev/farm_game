(function defineGameData() {
  "use strict";

  const shopItems = {
    "weed-killer": { name: "Weed Killer", price: 10, asset: "weed_killer_icon", tool: "weed-killer" },
    fertiliser: { name: "Fertiliser", price: 7, asset: "fertiliser_icon", tool: "fertiliser" },
    "water-upgrade": { name: "Water Upgrade", price: 30, asset: "water_upgrade_icon", upgrade: "water" },
    "harvest-upgrade": { name: "Harvest Upgrade", price: 40, asset: "harvest_upgrade_icon", upgrade: "cut" },
  };

  const crops = [
    { name: "Wheat", icon: "🌾", asset: "wheat_crop", waterNeeded: 4, rarity: 1, spawnWeight: 48 },
    { name: "Corn", icon: "🌽", asset: "corn_crop", waterNeeded: 5, rarity: 2, spawnWeight: 28 },
    { name: "Cotton", icon: "☁️", asset: "cotton_crop", waterNeeded: 6, rarity: 3, spawnWeight: 14 },
    { name: "Tomato", icon: "🍅", asset: "tomato_crop", waterNeeded: 7, rarity: 4, spawnWeight: 7 },
    { name: "Sugarcane", icon: "🎋", asset: "sugarcane_crop", waterNeeded: 8, rarity: 5, spawnWeight: 3 },
  ];

  window.FarmGameData = { shopItems, crops };
}());
