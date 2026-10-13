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

  async function slideCardAway(card, container, selector, duration = 360) {
    const previousPositions = captureCardPositions(container, selector);
    await card.animate(
      [
        { opacity: 1, transform: "translateX(0) scale(1)" },
        { opacity: 0, transform: "translateX(70px) scale(0.82)" },
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

  window.FarmGameUi = {
    activateOnPress,
    animateCardLayout,
    animateCropAppearance,
    animateFlyingIcon,
    captureCardPositions,
    cropSlug,
    isActionLocked: () => actionLocked,
    loadGraphic,
    openConfirmation,
    playPoofAt,
    slideCardAway,
  };
}());
