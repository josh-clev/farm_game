(function defineGameData() {
  "use strict";

  const crops = [
    { name: "Wheat", icon: "🌾", asset: "wheat_crop", waterNeeded: 4, rarity: 1, marketValue: 11, spawnWeight: 25 },
    { name: "Corn", icon: "🌽", asset: "corn_crop", waterNeeded: 5, rarity: 2, marketValue: 15, spawnWeight: 21 },
    { name: "Cotton", icon: "☁️", asset: "cotton_crop", waterNeeded: 6, rarity: 3, marketValue: 19, spawnWeight: 20 },
    { name: "Tomato", icon: "🍅", asset: "tomato_crop", waterNeeded: 7, rarity: 4, marketValue: 24, spawnWeight: 18 },
    { name: "Sugarcane", icon: "🎋", asset: "sugarcane_crop", waterNeeded: 8, rarity: 5, marketValue: 29, spawnWeight: 16 },
  ];

  const seedItems = Object.fromEntries(crops.map((crop) => {
    const key = `seed-${crop.name.toLowerCase()}`;
    return [key, {
      name: `${crop.name} Seed`,
      get price() { return crop.marketValue - 1; },
      asset: `${crop.name.toLowerCase()}_seed`,
      seedCrop: crop.name,
    }];
  }));

  const shopItems = {
    "weed-killer": { name: "Weed Killer", price: 15, asset: "weed_killer_icon", tool: "weed-killer" },
    fertiliser: { name: "Fertiliser", price: 10, asset: "fertiliser_icon", tool: "fertiliser" },
    "plot-upgrade": { name: "Plot Upgrade", price: 25, asset: "plot_upgrade", tool: "plot-upgrade" },
    "water-upgrade": { name: "Water Upgrade", price: 30, asset: "water_upgrade_icon", upgrade: "water" },
    "harvest-upgrade": { name: "Harvest Upgrade", price: 40, asset: "harvest_upgrade_icon", upgrade: "cut" },
    "storage-upgrade": { name: "Storage Upgrade", price: 20, asset: "storage_upgrade", upgrade: "storage" },
    market: { name: "Market", price: 40, asset: "market", upgrade: "market" },
    ...seedItems,
  };

  window.FarmGameData = { shopItems, crops, aiTrainingEnabled: true };
}());
