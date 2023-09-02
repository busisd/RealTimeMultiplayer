var socket = io();

const FRAME_TIME_MS = 1000 / 60;
const SERVER_TIME_MS = 1000 / 20;
const PLAYER_SPEED_PER_MS = .25;

const gameContainerElement = document.getElementById("game-container");
const pingDisplay = document.getElementById("ping");

var playerId;

// PIXI setup
const app = new PIXI.Application({
  width: 400,
  height: 400,
  backgroundColor: 0x1099bb,
  resolution: window.devicePixelRatio || 1,
});
gameContainerElement.appendChild(app.view);

const gameContainer = new PIXI.Container();
app.stage.addChild(gameContainer);
const gameGraphics = new PIXI.Graphics();
gameContainer.addChild(gameGraphics);

gameGraphics.lineStyle(0, 0xff0000);
gameGraphics.beginFill(0xff0000);


socket.on("clientConnected", (newPlayerId) => {
  playerId = newPlayerId;
  console.log("Connected with ID", playerId);
});

var playerColors = {};
socket.on("updatePlayerColors", (newPlayerColors) => {
  playerColors = newPlayerColors;
});

var timestampedStoredPositions = {};
// We store the newest received updates from the server,
// then do the actual updates in the client physics loop.
// This stops position from changing between physics ticks.
var newestReceivedMainPlayerServerPosition;
var mainPlayerServerPosition;
var newestReceivedLastServerUpdateTimestamp;
var lastServerUpdateTimestamp;
var mainPlayerClientPosition;
socket.on("updatePos", ({ playerPositions: newPlayerPositions }) => {
  const updateReceivedTime = performance.now();
  for (const [curPlayerId, curPlayerPosition] of Object.entries(newPlayerPositions)) {
    const newTimestampedPosition = {
      timestamp: updateReceivedTime,
      ...curPlayerPosition
    }
    if (!timestampedStoredPositions[curPlayerId]) {
      timestampedStoredPositions[curPlayerId] = {
        newestPosition: newTimestampedPosition,
        previousPosition: {
          timestamp: updateReceivedTime - SERVER_TIME_MS,
          ...curPlayerPosition
        }
      }
    } else {
      timestampedStoredPositions[curPlayerId].previousPosition = timestampedStoredPositions[curPlayerId].newestPosition;
      timestampedStoredPositions[curPlayerId].newestPosition = newTimestampedPosition;
    }
  }

  // Remove disconnected players
  const playerIdsReceived = Object.keys(newPlayerPositions);
  for (const curPlayerId of Object.keys(timestampedStoredPositions)) {
    if (!playerIdsReceived.includes(curPlayerId)) {
      delete timestampedStoredPositions[curPlayerId]
    }
  }

  if (logData) console.log("Received server update!")
  newestReceivedMainPlayerServerPosition = { ...newPlayerPositions[playerId] };
  newestReceivedLastServerUpdateTimestamp = updateReceivedTime;
  if (mainPlayerClientPosition == null && newPlayerPositions[playerId] != null) {
    mainPlayerClientPosition = { ...newPlayerPositions[playerId] };
  }
});

var logData = false;
const keyData = { up: false, right: false, down: false, left: false };
window.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowUp":
      keyData.up = true;
      break;
    case "ArrowRight":
      keyData.right = true;
      break;
    case "ArrowDown":
      keyData.down = true;
      break;
    case "ArrowLeft":
      keyData.left = true;
      break;
    case "t":
      // For testing
      mainPlayerClientPosition.x += 50;
      mainPlayerClientPosition.y += 50;
      break;
    case "p":
      // For testing
      logData = !logData;
  }

  socket.emit('updatePlayerInput', { keyData });
});

window.addEventListener("keyup", (e) => {
  switch (e.key) {
    case "ArrowUp":
      keyData.up = false;
      break;
    case "ArrowRight":
      keyData.right = false;
      break;
    case "ArrowDown":
      keyData.down = false;
      break;
    case "ArrowLeft":
      keyData.left = false;
      break;
  }

  socket.emit('updatePlayerInput', { keyData });
});

// Ping check
const randRange = (min, max) => Math.floor(Math.random() * (max - min)) + min;
const arrAvg = arr => arr.reduce((a, b) => a + b) / arr.length;
var pendingPingChecks = {};
const measuredPings = [];
var avgPing = 0;
setInterval(() => {
  const timestamp = performance.now();
  const requestId = randRange(0, 10000000).toString();
  pendingPingChecks[requestId] = timestamp
  socket.emit("checkPingRequest", { requestId });
}, 1000);
socket.on("checkPingResponse", ({ requestId }) => {
  const responseTimestamp = performance.now();
  const requestTimestamp = pendingPingChecks[requestId];
  delete pendingPingChecks[requestId];
  measuredPings.push((responseTimestamp - requestTimestamp) / 2 * 2); // TODO: REMOVE TEMPORARY *2, it's just for testing
  if (measuredPings.length > 5) {
    measuredPings.shift();
  }
  avgPing = arrAvg(measuredPings);
  pingDisplay.innerText = Math.round(avgPing);
})

var playerMovementTimeline = [];
var newestFrameTimestamp = performance.now();
function drawSquaresSimple(highResTime) {
  if (mainPlayerClientPosition) {
    while (highResTime > newestFrameTimestamp + FRAME_TIME_MS) {
      mainPlayerServerPosition = newestReceivedMainPlayerServerPosition;
      lastServerUpdateTimestamp = newestReceivedLastServerUpdateTimestamp
      
      // Move based on inputs
      if (keyData.up) mainPlayerClientPosition.y -= PLAYER_SPEED_PER_MS * FRAME_TIME_MS;
      if (keyData.right) mainPlayerClientPosition.x += PLAYER_SPEED_PER_MS * FRAME_TIME_MS;
      if (keyData.down) mainPlayerClientPosition.y += PLAYER_SPEED_PER_MS * FRAME_TIME_MS;
      if (keyData.left) mainPlayerClientPosition.x -= PLAYER_SPEED_PER_MS * FRAME_TIME_MS;

      // Move the player towards where the server believes them to be
      mainPlayerClientPosition.x -= (mainPlayerClientPosition.x - mainPlayerServerPosition.x) * .2
      mainPlayerClientPosition.y -= (mainPlayerClientPosition.y - mainPlayerServerPosition.y) * .2

      // Timeline-based movement based on server ping
      let dx = 0;
      let dy = 0;
      if (keyData.up) dy -= PLAYER_SPEED_PER_MS * FRAME_TIME_MS;
      if (keyData.right) dx += PLAYER_SPEED_PER_MS * FRAME_TIME_MS;
      if (keyData.down) dy += PLAYER_SPEED_PER_MS * FRAME_TIME_MS;
      if (keyData.left) dx -= PLAYER_SPEED_PER_MS * FRAME_TIME_MS;
      if (dx != 0 || dy != 0) {
        playerMovementTimeline.push({ timestamp: newestFrameTimestamp, dx, dy });
      }
      while (playerMovementTimeline.length > 0 && playerMovementTimeline[0].timestamp < lastServerUpdateTimestamp - avgPing) {
        playerMovementTimeline.shift();
      }

      if (logData) {
        // console.log([...playerMovementTimeline], lastServerUpdateTimestamp, newestFrameTimestamp, avgPing)
        const totalMovement = playerMovementTimeline.reduce(({ dx: accumX, dy: accumY }, { dx: newX, dy: newY }) => ({ dx: accumX + newX, dy: accumY + newY }), { dx: 0, dy: 0 })
        console.log(
          // mainPlayerServerPosition,
          // totalMovement,
          "A",
          {
            x: Math.round(mainPlayerServerPosition.x + totalMovement.dx),
            y: Math.round(mainPlayerServerPosition.y + totalMovement.dy),
          },
          [...playerMovementTimeline]
        );
      }

      newestFrameTimestamp += FRAME_TIME_MS;
    }
  }

  let playerPredictedPosition;
  if (mainPlayerClientPosition) {
    playerPredictedPosition = { ...mainPlayerClientPosition };
    const frameInterpolationTime = highResTime - newestFrameTimestamp;
    if (keyData.up) playerPredictedPosition.y -= PLAYER_SPEED_PER_MS * frameInterpolationTime;
    if (keyData.right) playerPredictedPosition.x += PLAYER_SPEED_PER_MS * frameInterpolationTime;
    if (keyData.down) playerPredictedPosition.y += PLAYER_SPEED_PER_MS * frameInterpolationTime;
    if (keyData.left) playerPredictedPosition.x -= PLAYER_SPEED_PER_MS * frameInterpolationTime;
  }

  gameGraphics.clear();
  gameGraphics.lineStyle(0, 0xff0000);
  for (const [curPlayerId, curPosition] of Object.entries(timestampedStoredPositions)) {
    if (playerColors[curPlayerId]) {
      gameGraphics.beginFill(playerColors[curPlayerId]);
    } else {
      gameGraphics.beginFill(0xff0000);
    }
    if (curPlayerId === playerId) {
      // gameGraphics.drawRect(playerPredictedPosition.x, playerPredictedPosition.y, 20, 20);

      let playerX = mainPlayerServerPosition.x;
      let playerY = mainPlayerServerPosition.y;
      for (const { dx, dy } of playerMovementTimeline) {
        playerX += dx;
        playerY += dy;
      }

      if (logData) {
        console.log(
          "B",
          {
            x: playerX,
            y: playerY,
          },
          [...playerMovementTimeline]
        );
      }

      gameGraphics.drawRect(playerX, playerY, 20, 20);
    } else {
      const xDiff = curPosition.newestPosition.x - curPosition.previousPosition.x;
      const yDiff = curPosition.newestPosition.y - curPosition.previousPosition.y;
      const timeDiff = curPosition.newestPosition.timestamp - curPosition.previousPosition.timestamp;
      const timeSinceNewestPosition = highResTime - curPosition.newestPosition.timestamp;

      const interpolationFactor = timeSinceNewestPosition / timeDiff;

      const posX = curPosition.previousPosition.x + (xDiff * interpolationFactor);
      const posY = curPosition.previousPosition.y + (yDiff * interpolationFactor);

      gameGraphics.drawRect(posX, posY, 20, 20);
    }
  }
}

function animationLoop(highResTime) {
  drawSquaresSimple(highResTime);
  window.requestAnimationFrame(animationLoop);
}

window.requestAnimationFrame(animationLoop);

