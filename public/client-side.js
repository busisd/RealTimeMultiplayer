var socket = io();

const PLAYER_SPEED_PER_MS = .25; //Player speed per millisecond

var playerId;

// const textP = document.getElementById("text");

// socket.on("printChar", (data) => {
//   console.log(data);
//   textP.innerText += data;
// });

const app = new PIXI.Application({
  width: 400,
  height: 400,
  backgroundColor: 0x1099bb,
  resolution: window.devicePixelRatio || 1,
});
document.body.appendChild(app.view);

const gameContainer = new PIXI.Container();
app.stage.addChild(gameContainer);
const gameGraphics = new PIXI.Graphics();
gameContainer.addChild(gameGraphics);

gameGraphics.lineStyle(0, 0xff0000);
gameGraphics.beginFill(0xff0000);
var x = 20;
var y = 20;
// gameGraphics.drawRect(x, y, 20, 20);
var playerPositions = {};
var playerColors = {};
var displayPositions = {};

function drawSquares() {
  gameGraphics.clear();
  gameGraphics.lineStyle(0, 0xff0000);
  
  if (displayPositions) {
    for (entry of Object.entries(displayPositions)) {
      if (playerColors[entry[0]]) {
        gameGraphics.beginFill(playerColors[entry[0]]);
      } else {
        gameGraphics.beginFill(0xff0000);
      }
      gameGraphics.drawRect(entry[1].x, entry[1].y, 20, 20);
    }
  }
}

socket.on("clientConnected", (newPlayerId) => {
  playerId = newPlayerId;
  console.log("Connected with ID", playerId);
});

socket.on("updatePlayerColors", (newPlayerColors) => {
  playerColors = newPlayerColors;
});

var playerStoredPositions = {};
var playerStoredPositionsArr = [];
var mainPlayerServerPosition;
var mainPlayerClientPosition;
socket.on("updatePos", ({playerPositions: newPlayerPositions, time}) => {
  playerStoredPositions = newPlayerPositions;
  const newPlayerPositionsEntry = {
    timestamp: performance.now(),
    positions: newPlayerPositions
  }
  playerStoredPositionsArr.push(newPlayerPositionsEntry);
  if (playerStoredPositionsArr.length < 2) {
    playerStoredPositionsArr.push(newPlayerPositionsEntry);
  }
  if (playerStoredPositionsArr.length > 2) {
    playerStoredPositionsArr.shift();
  }
  mainPlayerServerPosition = { ...newPlayerPositions[playerId] };
  if (mainPlayerClientPosition == null) {
    mainPlayerClientPosition = { ...newPlayerPositions[playerId] };
  }

  // newestFrameTimestamp = performance.now();
  // console.log(playerPositions, playerNum, playerPositions[playerNum]);
  // playerPositions = newPlayerPositions;
  const clientTime = Date.now();

  for (entry of Object.entries(newPlayerPositions)) {
    if (entry[0] === playerId) {
      displayPositions[entry[0]] = entry[1];
    } else {
      if (playerPositions[entry[0]]) {
        playerPositions[entry[0]].push([clientTime, entry[1]])
      } else {
        playerPositions[entry[0]] = [[clientTime, entry[1]]]
      }
    }
  }

  //Remove disconnected players
  for (key of Object.keys(playerPositions)) {
    if (!newPlayerPositions[key]) {
      delete playerPositions[key];
      delete displayPositions[key];
    }
  }
});

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

const INTERPOLATION_DISPLAY_MS = 100;

function getWrappingTimesIndex(timestamp, timeQueue) {
  index = 0;
  if (timeQueue.length < 2) {
    return -1;
  }

  while (timeQueue[index+1][0] < timestamp) {
    index += 1;

    if (index >= timeQueue.length) return -1;
  }

  return index;
}

var clientPhysicsLoopVar;
function clientPhysicsLoop(prevTime) {
  const curTime = Date.now();
  const deltaTime = curTime - prevTime;

  if (playerId != null && displayPositions[playerId]) {
    if (keyData.up) displayPositions[playerId].y -= PLAYER_SPEED_PER_MS * deltaTime;
    if (keyData.right) displayPositions[playerId].x += PLAYER_SPEED_PER_MS * deltaTime;
    if (keyData.down) displayPositions[playerId].y += PLAYER_SPEED_PER_MS * deltaTime;
    if (keyData.left) displayPositions[playerId].x -= PLAYER_SPEED_PER_MS * deltaTime;
  }

  drawSquares();

  // socket.emit("movePlayer", { playerNum, keyData });
  // console.log(playerPositions);
  
  for (entry of Object.entries(playerPositions)) {
    if (entry[0] != playerId) {
      //entry = [playerID, [[time, {x: 20, y: 20}], ...]]
      // console.log("ENTRY[1]:", entry[1]);
      const posQueue = entry[1];

      // console.log(curTime, (posQueue.length > 0) ? posQueue[0][0] : "NONE", INTERPOLATION_DISPLAY_MS, posQueue.length > 0 && posQueue[0][0] < curTime - INTERPOLATION_DISPLAY_MS, curTime - INTERPOLATION_DISPLAY_MS);
      // console.log(posQueue.length > 0, posQueue[0][0] < curTime - INTERPOLATION_DISPLAY_MS, posQueue[0][0], curTime - INTERPOLATION_DISPLAY_MS);
      while (posQueue.length > 0 && posQueue[0][0] < curTime - INTERPOLATION_DISPLAY_MS*2) {
        posQueue.shift();
      }

      // console.log(posQueue.length);
      if (posQueue.length > 0) {
        // console.log(posQueue.shift()[1]);
        // displayPositions[entry[0]] = posQueue.shift()[1];

        if (posQueue.length == 1) {
          displayPositions[entry[0]] = posQueue[0][1];
        } else {
          const i = getWrappingTimesIndex(curTime - INTERPOLATION_DISPLAY_MS, posQueue);
          if (i > 0) {
            const percentThru = ((curTime - INTERPOLATION_DISPLAY_MS) - posQueue[i][0]) / (posQueue[i+1][0] - posQueue[i][0]);
            // console.log(curTime, INTERPOLATION_DISPLAY_MS, posQueue[0][0], posQueue[1][0], posQueue[0][0]);
            // console.log(((curTime - INTERPOLATION_DISPLAY_MS) - posQueue[0][0]), (posQueue[1][0] - posQueue[0][0]));
            // console.log(percentThru);
            const newX = (posQueue[i+1][1].x - posQueue[i][1].x) * percentThru + posQueue[i][1].x;
            const newY = (posQueue[i+1][1].y - posQueue[i][1].y) * percentThru + posQueue[i][1].y;
            displayPositions[entry[0]] = {x: newX, y: newY};  
          }
        }
      }
    }
  }

  clientPhysicsLoopVar = setTimeout(() => clientPhysicsLoop(curTime), 15);
  //TODO: Change this to RequestAnimationFrame
}

const FRAME_TIME_MS = 1000 / 60;
const SERVER_TIME_MS = 1000 / 20;
var newestFrameTimestamp = performance.now();
function drawSquaresSimple(highResTime) {

  if (mainPlayerClientPosition) {
    while (highResTime > newestFrameTimestamp + FRAME_TIME_MS) {
      // Move based on inputs
      if (keyData.up) mainPlayerClientPosition.y -= PLAYER_SPEED_PER_MS * FRAME_TIME_MS;
      if (keyData.right) mainPlayerClientPosition.x += PLAYER_SPEED_PER_MS * FRAME_TIME_MS;
      if (keyData.down) mainPlayerClientPosition.y += PLAYER_SPEED_PER_MS * FRAME_TIME_MS;
      if (keyData.left) mainPlayerClientPosition.x -= PLAYER_SPEED_PER_MS * FRAME_TIME_MS;
  
      // Move the player towards where the server believes them to be
      mainPlayerClientPosition.x -= (mainPlayerClientPosition.x - mainPlayerServerPosition.x) * .2
      mainPlayerClientPosition.y -= (mainPlayerClientPosition.y - mainPlayerServerPosition.y) * .2

      newestFrameTimestamp += FRAME_TIME_MS;
    }
  }

  let playerPredictedPosition;
  if (mainPlayerClientPosition) {
    playerPredictedPosition = {...mainPlayerClientPosition};
    const frameInterpolationTime = highResTime - newestFrameTimestamp;
    if (keyData.up) playerPredictedPosition.y -= PLAYER_SPEED_PER_MS * frameInterpolationTime;
    if (keyData.right) playerPredictedPosition.x += PLAYER_SPEED_PER_MS * frameInterpolationTime;
    if (keyData.down) playerPredictedPosition.y += PLAYER_SPEED_PER_MS * frameInterpolationTime;
    if (keyData.left) playerPredictedPosition.x -= PLAYER_SPEED_PER_MS * frameInterpolationTime;
  }

  gameGraphics.clear();
  gameGraphics.lineStyle(0, 0xff0000);
  for (const [curPlayerId, curPosition] of Object.entries(playerStoredPositions)) {
    if (playerColors[curPlayerId]) {
      gameGraphics.beginFill(playerColors[curPlayerId]);
    } else {
      gameGraphics.beginFill(0xff0000);
    }
    // console.log(curPlayerId, playerId, playerStoredPositions, curPlayerId === playerId)
    if (curPlayerId === playerId) {
      gameGraphics.drawRect(playerPredictedPosition.x, playerPredictedPosition.y, 20, 20);
    } else {
      gameGraphics.drawRect(curPosition.x, curPosition.y, 20, 20);

      // const interpolationFactor = // TODO;
    }
  }
}

function animationLoop(highResTime) {
  drawSquaresSimple(highResTime);
  window.requestAnimationFrame(animationLoop);
}

// Old physics/animation loop
// clientPhysicsLoop(Date.now());
// New physics/animation loop
window.requestAnimationFrame(animationLoop);
