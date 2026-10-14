(function defineGameUi() {
  "use strict";

  let actionLocked = false;

  function loadGraphic(name, onLoad) {
    const extensions = ["png", "jpg"];
    let candidate = 0;

    function tryNext() {
      if (candidate >= extensions.length) return;
      const image = new Image();
      image.onload = () => onLoad(image.src);
      image.onerror = () => {
        candidate += 1;
        tryNext();
      };
      image.src = `assets/${name}.${extensions[candidate]}`;
    }

    tryNext();
  }

  function cropSlug(name) {
    return name.toLowerCase().replaceAll(" ", "-");
  }

  function activateOnPress(element, handler) {
    element.addEventListener("click", handler);
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handler(event);
    });
  }

  function closeConfirmation(card) {
    const confirmation = card.querySelector(".confirmation-box");
    if (!confirmation) return;
    confirmation.classList.remove("is-open");
    confirmation.addEventListener("transitionend", () => confirmation.remove(), { once: true });
  }

  function openConfirmation(card, label, onConfirm) {
    if (actionLocked || card.getAttribute("aria-disabled") === "true") return;
    document.querySelectorAll(".confirmation-box").forEach((box) => box.remove());

    const confirmation = document.createElement("div");
    confirmation.className = "confirmation-box";
    confirmation.setAttribute("role", "group");
    confirmation.setAttribute("aria-label", label);
    confirmation.innerHTML = `
      <button class="confirmation-choice confirm" type="button" aria-label="Confirm">✓</button>
      <button class="confirmation-choice cancel" type="button" aria-label="Cancel">✕</button>
    `;
    confirmation.addEventListener("click", (event) => event.stopPropagation());
    confirmation.querySelector(".cancel").addEventListener("click", () => closeConfirmation(card));
    confirmation.querySelector(".confirm").addEventListener("click", async () => {
      if (actionLocked) return;
      actionLocked = true;
      confirmation.querySelectorAll("button").forEach((button) => { button.disabled = true; });
      try {
        await onConfirm();
      } finally {
        actionLocked = false;
      }
    });
    card.append(confirmation);
    requestAnimationFrame(() => {
      confirmation.classList.add("is-open");
      confirmation.querySelector(".confirm").focus({ preventScroll: true });
    });
  }

  function captureCardPositions(container, selector) {
    return new Map(
      [...container.querySelectorAll(selector)]
        .filter((card) => !card.hidden)
        .map((card) => [card.dataset.layoutKey, card.getBoundingClientRect()]),
    );
  }

  function animateCardLayout(container, selector, previousPositions, enteringKeys = new Set()) {
    [...container.querySelectorAll(selector)].filter((card) => !card.hidden).forEach((card) => {
      const previous = previousPositions.get(card.dataset.layoutKey);
      if (previous) {
        const current = card.getBoundingClientRect();
        card.animate(
          [
            { transform: `translate(${previous.left - current.left}px, ${previous.top - current.top}px)` },
            { transform: "translate(0, 0)" },
          ],
          { duration: 440, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      } else if (enteringKeys.has(card.dataset.layoutKey)) {
        card.animate(
          [
            { opacity: 0, transform: "translateY(-30px) scale(0.75)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
          { duration: 480, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      }
    });
  }

  async function slideCardAway(card, container, selector, duration = 360, direction = "right") {
    const previousPositions = captureCardPositions(container, selector);
    const exitTransform = direction === "up"
      ? "translateY(-70px) scale(0.82)"
      : direction === "down"
      ? "translateY(70px) scale(0.82)"
      : "translateX(70px) scale(0.82)";
    await card.animate(
      [
        { opacity: 1, transform: "translateX(0) scale(1)" },
        { opacity: 0, transform: exitTransform },
      ],
      { duration, easing: "cubic-bezier(0.55, 0, 1, 0.45)", fill: "forwards" },
    ).finished;
    card.hidden = true;
    card.getAnimations().forEach((animation) => animation.cancel());
    animateCardLayout(container, selector, previousPositions);
  }

  function animateFlyingIcon(source, target, displayIcon = source, duration = 560) {
    if (!source || !target || !displayIcon) return Promise.resolve();
    const sourceBounds = source.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    const displayBounds = displayIcon.getBoundingClientRect();
    const flyer = displayIcon.cloneNode(true);
    flyer.classList.add("transaction-flyer");
    flyer.style.left = `${sourceBounds.left + sourceBounds.width / 2 - displayBounds.width / 2}px`;
    flyer.style.top = `${sourceBounds.top + sourceBounds.height / 2 - displayBounds.height / 2}px`;
    flyer.style.width = `${displayBounds.width}px`;
    flyer.style.height = `${displayBounds.height}px`;
    document.body.append(flyer);
    const startLeft = sourceBounds.left + sourceBounds.width / 2 - displayBounds.width / 2;
    const startTop = sourceBounds.top + sourceBounds.height / 2 - displayBounds.height / 2;
    const deltaX = targetBounds.left + targetBounds.width / 2 - startLeft - displayBounds.width / 2;
    const deltaY = targetBounds.top + targetBounds.height / 2 - startTop - displayBounds.height / 2;
    return flyer.animate(
      [
        { transform: "translate(0, 0)", opacity: 1, offset: 0 },
        { transform: "translate(0, -18px)", opacity: 1, offset: 0.22 },
        { transform: `translate(${deltaX}px, ${deltaY}px)`, opacity: 1, offset: 0.9 },
        { transform: `translate(${deltaX}px, ${deltaY}px)`, opacity: 0, offset: 1 },
      ],
      { duration, easing: "cubic-bezier(0.45, 0, 0.25, 1)", fill: "forwards" },
    ).finished.finally(() => flyer.remove());
  }

  function playPoofAt(bounds) {
    const poof = document.createElement("span");
    poof.className = "harvest-poof";
    poof.style.left = `${bounds.left + bounds.width / 2}px`;
    poof.style.top = `${bounds.top + bounds.height / 2}px`;
    poof.addEventListener("animationend", () => poof.remove(), { once: true });
    document.body.append(poof);
  }

  function animateCropAppearance(cropElement) {
    requestAnimationFrame(() => {
      playPoofAt(cropElement.getBoundingClientRect());
      cropElement.classList.add("is-spawning");
      cropElement.addEventListener(
        "animationend",
        () => cropElement.classList.remove("is-spawning"),
        { once: true },
      );
    });
  }

  function animateTreatment(plot, type) {
    const crop = plot?.querySelector(".crop");
    if (!crop) return Promise.resolve();
    const bounds = crop.getBoundingClientRect();
    const treatment = document.createElement("span");
    const asset = type === "water" ? "watering_can" : `${type.replace("-", "_")}_icon`;
    const isPlayerTwo = plot.classList.contains("player-two-plot");
    const sideOffset = bounds.width * (isPlayerTwo ? 0.56 : -0.56);
    treatment.className = `treatment-animation treatment-${type}${isPlayerTwo ? " treatment-player-two" : " treatment-player-one"}`;
    treatment.style.left = `${bounds.left + bounds.width / 2 + sideOffset}px`;
    treatment.style.top = `${bounds.top + bounds.height * 0.12}px`;
    treatment.style.width = `${bounds.width * 0.72}px`;
    treatment.style.height = `${bounds.height * 0.72}px`;
    treatment.style.setProperty("--treatment-flip", isPlayerTwo ? "1" : "-1");
    treatment.style.setProperty("--treatment-image", `url("assets/${asset}.png")`);
    const effect = document.createElement("span");
    effect.className = "treatment-effect";
    treatment.append(effect);
    document.body.append(treatment);

    const keyframes = type === "weed-killer"
      ? [
        { opacity: 0, transform: "translate(-50%, -50%) scaleX(var(--treatment-flip)) scale(0.78) rotate(0deg)" },
        { opacity: 1, transform: "translate(-50%, -50%) scaleX(var(--treatment-flip)) scale(1) rotate(0deg)", offset: 0.14 },
        { opacity: 1, transform: "translate(-50%, -50%) scaleX(var(--treatment-flip)) scale(1.04) rotate(-4deg)", offset: 0.7 },
        { opacity: 0, transform: "translate(-50%, -50%) scaleX(var(--treatment-flip)) scale(0.9) rotate(0deg)", offset: 1 },
      ]
      : [
        { opacity: 0, transform: "translate(-50%, -50%) scaleX(var(--treatment-flip)) scale(0.78) rotate(0deg)" },
        { opacity: 1, transform: "translate(-50%, -50%) scaleX(var(--treatment-flip)) scale(1) rotate(0deg)", offset: 0.14 },
        { opacity: 1, transform: "translate(-50%, -50%) scaleX(var(--treatment-flip)) scale(1) rotate(-48deg)", offset: 0.46 },
        { opacity: 1, transform: "translate(-50%, -50%) scaleX(var(--treatment-flip)) scale(1) rotate(-48deg)", offset: 0.7 },
        { opacity: 0, transform: "translate(-50%, -50%) scaleX(var(--treatment-flip)) scale(0.9) rotate(0deg)", offset: 1 },
      ];

    return treatment.animate(keyframes, {
      duration: 1500,
      easing: "cubic-bezier(0.22, 0.8, 0.36, 1)",
      fill: "forwards",
    }).finished.finally(() => treatment.remove());
  }

  window.FarmGameUi = {
    activateOnPress,
    animateCardLayout,
    animateCropAppearance,
    animateFlyingIcon,
    animateTreatment,
    captureCardPositions,
    cropSlug,
    isActionLocked: () => actionLocked,
    loadGraphic,
    openConfirmation,
    playPoofAt,
    slideCardAway,
  };
}());
