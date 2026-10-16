function announceTurn() {
  const playerName = `Player ${currentPlayer}`;
  turnAnnouncement.textContent = `${playerName}'s Turn!`;
  turnAnnouncement.classList.remove("round-announcement");
  turnAnnouncement.classList.toggle("player-one", currentPlayer === 1);
  turnAnnouncement.classList.toggle("player-two", currentPlayer === 2);
  actionDock.classList.toggle("player-one-dock", currentPlayer === 1);
  actionDock.classList.toggle("player-two-dock", currentPlayer === 2);

  playAnnouncementAnimation();
}

function playAnnouncementAnimation() {
  turnAnnouncement.classList.remove("is-playing");
  void turnAnnouncement.offsetWidth;
  return new Promise((resolve) => {
    let timeoutId;
    const finish = () => {
      window.clearTimeout(timeoutId);
      turnAnnouncement.removeEventListener("animationend", finish);
      resolve();
    };
    turnAnnouncement.addEventListener("animationend", finish, { once: true });
    turnAnnouncement.classList.add("is-playing");
    timeoutId = window.setTimeout(finish, 1600);
  });
}

function announceRound() {
  turnAnnouncement.textContent = `Round ${currentRound}!`;
  turnAnnouncement.classList.remove("player-one", "player-two");
  turnAnnouncement.classList.add("round-announcement");
  return playAnnouncementAnimation();
}
