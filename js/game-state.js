const grid = document.querySelector(".farm-grid");
const nextTurnButton = document.querySelector(".next-turn");
const turnAnnouncement = document.querySelector(".turn-announcement");
const toolButtons = [...document.querySelectorAll(".tool-button")];
const waterIcons = document.querySelector(".water-icons");
const cutIcons = document.querySelector(".cut-icons");
const actionDock = document.querySelector(".action-dock");
const orderList = document.querySelector(".order-list");
const orderRoundCount = document.querySelector(".order-round-count");
const mainMenu = document.querySelector(".main-menu");
const gameScene = document.querySelector(".game");
const victoryScreen = document.querySelector(".victory-screen");
const victorySummary = document.querySelector(".victory-summary");
const victoryPlayer = document.querySelector(".victory-player");
const playButton = document.querySelector(".play-button");
const playAiButton = document.querySelector(".play-ai-button");
const trainAiButton = document.querySelector(".train-ai-button");
const importAiButton = document.querySelector(".import-ai-button");
const importAiInput = document.querySelector(".import-ai-input");
const trainingStatus = document.querySelector(".training-status");
const exportAiButton = document.querySelector(".export-ai-button");
const exportAiGameButton = document.querySelector(".export-ai-game-button");
const returnMenuButton = document.querySelector(".return-menu-button");
const allShopCards = [...document.querySelectorAll(".shop-card")];
const shopCards = allShopCards.slice(0, 3);
allShopCards.slice(3).forEach((card) => { card.hidden = true; });
const { shopItems, crops } = window.FarmGameData;
const {
  activateOnPress,
  animateCardLayout,
  animateCropAppearance,
  animateFlyingIcon,
  animateTreatment,
  animateWeather,
  captureCardPositions,
  cropSlug,
  isActionLocked,
  loadGraphic,
  openConfirmation,
  playPoofAt,
  slideCardAway,
} = window.FarmGameUi;
let currentPlayer = 1;
let selectedTool = null;
let turnActions = { water: 3, cut: 1 };
const playerUpgrades = {
  1: { water: 0, cut: 0, storage: 0, market: 0 },
  2: { water: 0, cut: 0, storage: 0, market: 0 },
};
const playerUpgradeSlots = { 1: [null, null], 2: [null, null] };
let pendingUpgradePurchase = null;

const shopItemKeys = Object.keys(shopItems);
function drawShopItem(excludedKeys = new Set()) {
  const choices = shopItemKeys.filter((itemKey) => !excludedKeys.has(itemKey));
  return choices[Math.floor(Math.random() * choices.length)];
}

const initialShopKeys = new Set();
const shopSlots = shopCards.map(() => {
  const itemKey = drawShopItem(initialShopKeys);
  initialShopKeys.add(itemKey);
  return { itemKey, purchased: false };
});

const playerResources = {
  1: Object.fromEntries(crops.map((crop) => [crop.name, 0])),
  2: Object.fromEntries(crops.map((crop) => [crop.name, 0])),
};
const playerCoins = { 1: 50, 2: 50 };
const playerRenown = { 1: 0, 2: 0 };
const soldResources = { 1: Object.fromEntries(crops.map((crop) => [crop.name, 0])), 2: Object.fromEntries(crops.map((crop) => [crop.name, 0])) };
const earnedCoins = { 1: 0, 2: 0 };
let orders = [];
let spawnTimerPlot = null;
let nextOrderId = 1;
let turnsUntilShopRefresh = 10;
let turnsUntilOrderRefresh = 20;
let currentRound = 1;
const BASE_MAX_RESOURCES = 5;
let pendingDiscardCount = 0;
let discardAnimationRunning = false;
