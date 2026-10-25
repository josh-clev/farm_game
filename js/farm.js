async function animateHarvest(plot, cropName, player) {
  const cropElement = plot.querySelector(".crop");
  if (!cropElement) return;

  const cropBounds = cropElement.getBoundingClientRect();
  const targetPool = document.querySelector(`.resource-pool:nth-of-type(${player === 1 ? 1 : 2})`);
  const targetBounds = targetPool.getBoundingClientRect();
  const targetIcon = document.querySelector(
    `.resource-count[data-player="${player}"][data-crop="${cropName}"]`,
  )?.parentElement.querySelector(".resource-icon");
  const flyer = cropElement.cloneNode(true);
  flyer.className = "harvest-flyer";
  flyer.style.left = `${cropBounds.left}px`;
  flyer.style.top = `${cropBounds.top}px`;
  flyer.style.width = `${cropBounds.width}px`;
  flyer.style.height = `${cropBounds.height}px`;
  if (targetIcon) {
    flyer.textContent = targetIcon.textContent;
    flyer.style.backgroundImage = getComputedStyle(targetIcon).backgroundImage;
  }
  playPoofAt(cropBounds);
  document.body.append(flyer);
  cropElement.remove();

  const destinationX = targetBounds.left + targetBounds.width / 2 - cropBounds.width / 2;
  const destinationY = targetBounds.top + targetBounds.height / 2 - cropBounds.height / 2;
  const deltaX = destinationX - cropBounds.left;
  const deltaY = destinationY - cropBounds.top;

  await flyer.animate(
    [
      { transform: "translate(0, 0) scale(0.65)", opacity: 0, offset: 0 },
      { transform: "translate(0, -32px) scale(1.15)", opacity: 1, offset: 0.16 },
      { transform: "translate(0, -34px) scale(1.15)", opacity: 1, offset: 0.31 },
      { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.55)`, opacity: 1, offset: 0.88 },
      { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.25)`, opacity: 0, offset: 1 },
    ],
    { duration: 1748, easing: "cubic-bezier(0.45, 0, 0.25, 1)", fill: "forwards" },
  ).finished;

  flyer.remove();
}

function pickRandomCrop() {
  const totalWeight = crops.reduce((total, crop) => total + crop.spawnWeight, 0);
  let roll = Math.random() * totalWeight;

  for (const crop of crops) {
    roll -= crop.spawnWeight;
    if (roll < 0) return crop;
  }

  return crops[0];
}

function getPlotOwner(plot) {
  if (plot.classList.contains("player-one-plot")) return 1;
  if (plot.classList.contains("player-two-plot")) return 2;
  return null;
}

function canInteractWithPlot(plot, action) {
  return action === "weed-killer" || getPlotOwner(plot) === null || getPlotOwner(plot) === currentPlayer;
}

function canPlantSeed(plot, crop) {
  return !plot.dataset.crop
    && !plot.querySelector(".spawn-timer")
    && canInteractWithPlot(plot, "plant")
    && Boolean(crop);
}

function canUpgradePlot(plot) {
  return getPlotOwner(plot) === null
    && !plot.dataset.crop
    && !plot.querySelector(".spawn-timer");
}

function canPlaceAutoHarvester(plot) {
  return getPlotOwner(plot) === currentPlayer
    && !plot.dataset.crop
    && !plot.querySelector(".spawn-timer")
    && !plot.querySelector(".auto-harvester");
}

function createAutoHarvester(plot, owner) {
  const harvester = document.createElement("span");
  harvester.className = "auto-harvester is-missing-auto-harvester";
  harvester.setAttribute("role", "button");
  harvester.tabIndex = 0;
  harvester.dataset.owner = String(owner);
  harvester.dataset.charged = "true";
  harvester.setAttribute("aria-label", `Charged auto-harvester owned by Player ${owner}`);
  harvester.setAttribute("aria-pressed", "false");
  loadGraphic("auto_harvester", (source) => {
    harvester.style.backgroundImage = `url("${source}")`;
    harvester.classList.remove("is-missing-auto-harvester");
  });
  harvester.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    requestAutoHarvesterRecharge(harvester);
  });
  plot.append(harvester);
}

function setHarvesterCharge(harvester, charged) {
  harvester.dataset.charged = String(charged);
  harvester.classList.toggle("is-depleted", !charged);
  harvester.setAttribute(
    "aria-label",
    charged
      ? `Charged auto-harvester owned by Player ${harvester.dataset.owner}`
      : `Auto-harvester owned by Player ${harvester.dataset.owner}, recharge for 5 coins`,
  );
  harvester.replaceChildren();
  if (!charged) {
    const rechargeCost = document.createElement("span");
    rechargeCost.className = "harvester-recharge-cost";
    rechargeCost.setAttribute("aria-hidden", "true");
    rechargeCost.innerHTML = '5 <span class="coin-icon"></span>';
    harvester.append(rechargeCost);
  }
}

function areAdjacentPlots(first, second) {
  const firstIndex = Number(first.dataset.plot);
  const secondIndex = Number(second.dataset.plot);
  return Math.abs(Math.floor(firstIndex / 5) - Math.floor(secondIndex / 5))
    + Math.abs((firstIndex % 5) - (secondIndex % 5)) === 1;
}

async function harvestWithAutoHarvester(harvester, plot) {
  if (harvester.dataset.charged !== "true" || !plot.dataset.crop || plot.classList.contains("is-harvesting")) return false;
  const cropName = plot.dataset.crop;
  const owner = Number(harvester.dataset.owner);
  plot.classList.add("is-harvesting", "is-auto-harvesting");
  setHarvesterCharge(harvester, false);
  await animateHarvest(plot, cropName, owner);
  plot.querySelector(".crop-progress")?.remove();
  delete plot.dataset.crop;
  delete plot.dataset.water;
  delete plot.dataset.turnWatered;
  delete plot.dataset.waterNeeded;
  plot.classList.remove("fully-grown", "is-auto-harvesting", "is-harvesting");
  playerResources[owner][cropName] += 1;
  await updateResourcePool(owner, cropName);
  plot.setAttribute("aria-label", `Farm plot ${Number(plot.dataset.plot) + 1}`);
  renderOrders();
  return true;
}

async function triggerAutoHarvesters(readyPlots) {
  const availablePlots = readyPlots.filter((plot) => plot.dataset.crop && Number(plot.dataset.water) >= Number(plot.dataset.waterNeeded));
  if (!availablePlots.length) return;
  const harvesters = [...grid.querySelectorAll('.auto-harvester[data-charged="true"]')];
  for (const harvester of harvesters) {
    const harvesterPlot = harvester.closest(".plot");
    const choices = availablePlots.filter((plot) => areAdjacentPlots(harvesterPlot, plot) && !plot.classList.contains("is-harvesting"));
    if (!choices.length) continue;
    const target = choices[Math.floor(Math.random() * choices.length)];
    await harvestWithAutoHarvester(harvester, target);
    const targetIndex = availablePlots.indexOf(target);
    if (targetIndex >= 0) availablePlots.splice(targetIndex, 1);
  }
  renderTools();
}

async function rechargeAutoHarvester(harvester) {
  const owner = Number(harvester.dataset.owner);
  if (owner !== currentPlayer || harvester.dataset.charged === "true" || playerCoins[owner] < 5) return;
  const coinItem = document.querySelector(`.resource-pool.${owner === 1 ? "player-one" : "player-two"}-pool .coin-item`);
  await animateFlyingIcon(coinItem, harvester, coinItem?.querySelector(".coin-icon"));
  playerCoins[owner] -= 5;
  updateCoinDisplay(owner);
  setHarvesterCharge(harvester, true);
}

function requestAutoHarvesterRecharge(harvester) {
  if (Number(harvester.dataset.owner) !== currentPlayer || harvester.dataset.charged === "true" || playerCoins[currentPlayer] < 5) return;
  openConfirmation(harvester, "Recharge this auto-harvester for 5 coins?", () => rechargeAutoHarvester(harvester));
}

function plantCrop(plot, crop) {
  const cropIcon = document.createElement("span");
  cropIcon.className = "crop is-loading";
  cropIcon.setAttribute("aria-hidden", "true");

  loadGraphic(crop.asset, (source) => {
    cropIcon.style.backgroundImage = `url("${source}")`;
    cropIcon.classList.remove("is-loading");
    animateCropAppearance(cropIcon);
  });

  plot.dataset.crop = crop.name;
  plot.dataset.water = "0";
  plot.dataset.turnWatered = "0";
  plot.dataset.waterNeeded = String(crop.waterNeeded);
  plot.append(cropIcon);
  const progress = document.createElement("span");
  progress.className = "crop-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.innerHTML = '<span class="crop-progress-remaining"></span><span class="crop-progress-label"></span>';
  plot.append(progress);
  plot.setAttribute("aria-label", `${plot.getAttribute("aria-label")}, growing ${crop.name}`);
  updateCropProgress(plot);
}

function getNextCropSpawnTurns() {
  const existingPlantCount = neutralPlots.filter(
    (plot) => getPlotOwner(plot) === null && plot.dataset.crop,
  ).length;
  if (existingPlantCount <= 2) return 1;
  if (existingPlantCount <= 4) return 2;
  if (existingPlantCount <= 6) return 3;
  if (existingPlantCount === 7) return 4;
  return 5;
}

function queueNextCropSpawn() {
  const availablePlots = neutralPlots.filter(
    (plot) => getPlotOwner(plot) === null
      && !plot.dataset.crop
      && !plot.querySelector(".spawn-timer"),
  );
  if (availablePlots.length === 0) return;

  spawnTimerPlot = availablePlots[Math.floor(Math.random() * availablePlots.length)];
  const spawnTurns = getNextCropSpawnTurns();
  const timer = document.createElement("span");
  timer.className = "spawn-timer";
  timer.textContent = String(spawnTurns);
  timer.dataset.turns = String(spawnTurns);
  timer.setAttribute("aria-hidden", "true");
  spawnTimerPlot.append(timer);
  spawnTimerPlot.setAttribute(
    "aria-label",
    `${spawnTimerPlot.getAttribute("aria-label")}, crop arriving in ${spawnTurns} turns`,
  );
}

function advanceCropSpawnTimer() {
  const timer = spawnTimerPlot?.querySelector(".spawn-timer");
  if (!timer) {
    queueNextCropSpawn();
    return;
  }

  const turnsRemaining = Number(timer.dataset.turns) - 1;
  if (turnsRemaining > 0) {
    timer.dataset.turns = String(turnsRemaining);
    timer.textContent = String(turnsRemaining);
    spawnTimerPlot.setAttribute(
      "aria-label",
      `${spawnTimerPlot.getAttribute("aria-label").replace(/, crop arriving in \d+ turns$/, "")}, crop arriving in ${turnsRemaining} turns`,
    );
    return;
  }

  timer.remove();
  const plot = spawnTimerPlot;
  spawnTimerPlot = null;
  plot.setAttribute(
    "aria-label",
    plot.getAttribute("aria-label").replace(/, crop arriving in \d+ turns$/, ""),
  );
  if (getPlotOwner(plot) !== null) {
    queueNextCropSpawn();
    return;
  }
  plantCrop(plot, pickRandomCrop());
  queueNextCropSpawn();
}

function updateCropProgress(plot) {
  const progress = plot.querySelector(".crop-progress");
  if (!progress) return;

  const water = Number(plot.dataset.water);
  const waterNeeded = Number(plot.dataset.waterNeeded);
  const currentProgress = Math.min(1, water / waterNeeded);
  const remainingCapacity = Math.max(0, waterNeeded - water);
  const turnWatered = Number(plot.dataset.turnWatered || 0);
  const remainingThisTurn = Math.max(0, Math.min(2 - turnWatered, turnActions.water, remainingCapacity));
  progress.style.setProperty("--water-progress", String(currentProgress));
  progress.style.setProperty("--water-remaining", String(remainingThisTurn / waterNeeded));
  progress.querySelector(".crop-progress-label").textContent = `${water}/${waterNeeded}`;
  plot.classList.toggle("fully-grown", water >= waterNeeded);
}

function canUseTool(plot, tool) {
  if (tool === "plot-upgrade") return canUpgradePlot(plot);
  if (tool === "auto-harvester") return canPlaceAutoHarvester(plot);
  if (!plot.dataset.crop) return false;
  if (!canInteractWithPlot(plot, tool)) return false;

  if (tool === "weed-killer" || tool === "fertiliser") return true;

  const water = Number(plot.dataset.water);
  const waterNeeded = Number(plot.dataset.waterNeeded);
  const turnWatered = Number(plot.dataset.turnWatered || 0);
  return tool === "water"
    ? water < waterNeeded && turnWatered < 2
    : water >= waterNeeded;
}

function updateEligiblePlots() {
  grid.querySelectorAll(".plot").forEach((plot) => {
    const selectedCrop = selectedTool?.startsWith("seed:")
      ? crops.find((crop) => crop.name === selectedTool.slice(5))
      : null;
    const hasUse = selectedCrop
      ? canPlantSeed(plot, selectedCrop)
      : selectedTool === "plot-upgrade"
      ? canUpgradePlot(plot)
      : selectedTool === "auto-harvester"
      ? canPlaceAutoHarvester(plot)
      : selectedTool === "weed-killer" || selectedTool === "fertiliser"
      ? true
      : turnActions[selectedTool] > 0;
    plot.classList.toggle(
      "can-use-tool",
      Boolean(selectedTool && hasUse && (selectedCrop ? true : canUseTool(plot, selectedTool))),
    );
  });
}

function makeToolIcon(type, isBonus = false) {
  const icon = document.createElement("span");
  icon.className = `tool-icon ${type}-icon${isBonus ? " bonus-water-icon" : ""}`;
  icon.textContent = type === "water" ? "🪣" : "✂️";
  return icon;
}

function hasWaterablePlots() {
  return [...grid.querySelectorAll(".plot")].some((plot) => canUseTool(plot, "water"));
}

function getRegularWaterActions() {
  return Math.max(0, turnActions.water - playerUpgrades[currentPlayer].water);
}

function renderTools() {
  const bonusWater = Math.min(turnActions.water, playerUpgrades[currentPlayer].water);
  const regularWater = getRegularWaterActions();
  const farmActionRunning = Boolean(grid.querySelector(".is-treating"));
  waterIcons.replaceChildren(
    ...Array.from({ length: regularWater }, () => makeToolIcon("water")),
    ...Array.from({ length: bonusWater }, () => makeToolIcon("water", true)),
  );
  cutIcons.replaceChildren(...Array.from({ length: turnActions.cut }, () => makeToolIcon("cut")));

  toolButtons.forEach((button) => {
    const tool = button.dataset.tool;
    const isSelected = selectedTool === tool;
    button.classList.toggle("is-selected-tool", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
    button.disabled = turnActions[tool] === 0 || pendingDiscardCount > 0;
    button.setAttribute("aria-label", `${tool === "water" ? "Water" : "Harvest"}: ${turnActions[tool]} remaining`);
  });

  const mustUseWater = regularWater > 0 && hasWaterablePlots();
  nextTurnButton.disabled = farmActionRunning || mustUseWater || pendingDiscardCount > 0 || pendingUpgradePurchase;
  nextTurnButton.setAttribute(
    "aria-label",
    farmActionRunning
      ? "Next Turn: wait for the current action to finish"
      : mustUseWater
      ? `Next Turn: use all ${regularWater} regular water actions first`
      : "Next Turn",
  );

  grid.querySelectorAll(".plot[data-crop]").forEach(updateCropProgress);
  updateEligiblePlots();
  renderShop();
}

async function removeCrop(plot) {
  const cropElement = plot.querySelector(".crop");
  if (!cropElement) return;

  const cropBounds = cropElement.getBoundingClientRect();
  await cropElement.animate(
    [
      { transform: "translateY(-2%) rotate(0) scale(1)", opacity: 1 },
      { transform: "translateY(12%) rotate(18deg) scale(0)", opacity: 0 },
    ],
    { duration: 360, easing: "cubic-bezier(0.55, 0, 0.8, 0.35)" },
  ).finished;
  playPoofAt(cropBounds);
  cropElement.remove();
  plot.querySelector(".crop-progress")?.remove();
  delete plot.dataset.crop;
  delete plot.dataset.water;
  delete plot.dataset.turnWatered;
  delete plot.dataset.waterNeeded;
  plot.classList.remove("fully-grown");
  plot.setAttribute("aria-label", `Farm plot ${Number(plot.dataset.plot) + 1}`);
}

async function applyWeatherEvent() {
  const roll = Math.random();
  const weather = roll < 0.1 ? "rain" : roll < 0.2 ? "drought" : null;
  if (!weather) return;

  await animateWeather(weather);
  const cropsToRemove = [];
  const newlyReadyPlots = [];
  grid.querySelectorAll(".plot[data-crop]").forEach((plot) => {
    const water = Number(plot.dataset.water);
    const maxWater = Number(plot.dataset.waterNeeded);
    const nextWater = weather === "rain"
      ? Math.min(maxWater, water + 1)
      : Math.max(0, water - 1);
    plot.dataset.water = String(nextWater);
    if (weather === "drought" && water === 0) cropsToRemove.push(plot);
    else {
      updateCropProgress(plot);
      if (water < maxWater && nextWater >= maxWater) newlyReadyPlots.push(plot);
    }
  });

  await Promise.all(cropsToRemove.map(removeCrop));
  await triggerAutoHarvesters(newlyReadyPlots);
}

async function useTool(plot) {
  const canStackTreatment = selectedTool === "water";
  if ((plot.classList.contains("is-treating") && !canStackTreatment) || pendingDiscardCount > 0) return;
  plot.classList.add("is-treating");
  try {
  const selectedCrop = selectedTool?.startsWith("seed:")
    ? crops.find((crop) => crop.name === selectedTool.slice(5))
    : null;
  if (selectedCrop) {
    if (!canPlantSeed(plot, selectedCrop)) return;
    FarmAi.record(["plant", `plant:${selectedCrop.name}`]);
    plantCrop(plot, selectedCrop);
    selectedTool = null;
  } else if (selectedTool === "plot-upgrade") {
    if (!canUpgradePlot(plot)) return;
    FarmAi.record(["plot-upgrade"]);
    plot.classList.add(currentPlayer === 1 ? "player-one-plot" : "player-two-plot");
    plot.setAttribute("aria-label", `Farm plot ${Number(plot.dataset.plot) + 1}, Player ${currentPlayer} territory`);
    selectedTool = null;
  } else if (selectedTool === "auto-harvester") {
    if (!canPlaceAutoHarvester(plot)) return;
    createAutoHarvester(plot, currentPlayer);
    selectedTool = null;
  } else if (selectedTool === "water") {
    FarmGameAudio.playSound("water");
    FarmAi.record(FarmAi.actionKeys("water", plot.dataset.crop));
    plot.dataset.water = String(Number(plot.dataset.water) + 1);
    plot.dataset.turnWatered = String(Number(plot.dataset.turnWatered || 0) + 1);
    turnActions.water -= 1;
    updateCropProgress(plot);
    renderTools();
    await animateTreatment(plot, "water");
    if (Number(plot.dataset.water) >= Number(plot.dataset.waterNeeded)) await triggerAutoHarvesters([plot]);
  } else if (selectedTool === "cut") {
    const harvestedCrop = plot.dataset.crop;
    const harvestingPlayer = currentPlayer;
    if (plot.classList.contains("is-harvesting")) return;
    FarmGameAudio.playSound("harvest");
    FarmAi.record(FarmAi.actionKeys("harvest", harvestedCrop));
    plot.classList.add("is-harvesting");
    turnActions.cut -= 1;
    selectedTool = null;
    renderTools();
    await animateHarvest(plot, harvestedCrop, harvestingPlayer);
    plot.querySelector(".crop-progress")?.remove();
    delete plot.dataset.crop;
    delete plot.dataset.water;
    delete plot.dataset.waterNeeded;
    plot.classList.remove("fully-grown");
    playerResources[harvestingPlayer][harvestedCrop] += 1;
    await updateResourcePool(harvestingPlayer, harvestedCrop);
    beginDiscardSelection();
    renderTools();
    renderOrders();
    plot.setAttribute("aria-label", `Farm plot ${Number(plot.dataset.plot) + 1}`);
    plot.classList.remove("is-harvesting");
  } else if (selectedTool === "weed-killer") {
    FarmAi.record(["weed-killer"]);
    selectedTool = null;
    renderTools();
    await animateTreatment(plot, "weed-killer");
    await removeCrop(plot);
  } else if (selectedTool === "fertiliser") {
    FarmAi.record(FarmAi.actionKeys("fertiliser", plot.dataset.crop));
    plot.dataset.water = String(Number(plot.dataset.water) + 3);
    selectedTool = null;
    updateCropProgress(plot);
    await animateTreatment(plot, "fertiliser");
    if (Number(plot.dataset.water) >= Number(plot.dataset.waterNeeded)) await triggerAutoHarvesters([plot]);
  }

  if (selectedTool && turnActions[selectedTool] === 0) selectedTool = null;
  renderTools();
  } finally {
    plot.classList.remove("is-treating");
    renderTools();
  }
}
