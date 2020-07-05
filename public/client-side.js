var socket = io();

const PLAYER_SPEED_PER_MS = .15; //Player speed per millisecond

var playerNum = -1;

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

socket.on("clientConnected", (newPlayerNum) => {
  playerNum = newPlayerNum;
  console.log("Connected with ID", playerNum);
});

socket.on("updatePlayerColors", (newPlayerColors) => {
  playerColors = newPlayerColors;
});

socket.on("updatePos", ({playerPositions: newPlayerPositions, time}) => {
  // console.log(playerPositions, playerNum, playerPositions[playerNum]);
  // playerPositions = newPlayerPositions;
  const clientTime = Date.now();

  for (entry of Object.entries(newPlayerPositions)) {
    if (entry[0] == playerNum) {
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
  }
  
  socket.emit('updatePlayerInput', {playerNum, keyData});
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

  socket.emit('updatePlayerInput', {playerNum, keyData});
});

const INTERPOLATION_DISPLAY_MS = 100;

var clientPhysicsLoopVar;
function clientPhysicsLoop(prevTime) {
  const curTime = Date.now();
  const deltaTime = curTime - prevTime;

  if (playerNum > 0 && displayPositions[playerNum]) {
    if (keyData.up) displayPositions[playerNum].y -= PLAYER_SPEED_PER_MS * deltaTime;
    if (keyData.right) displayPositions[playerNum].x += PLAYER_SPEED_PER_MS * deltaTime;
    if (keyData.down) displayPositions[playerNum].y += PLAYER_SPEED_PER_MS * deltaTime;
    if (keyData.left) displayPositions[playerNum].x -= PLAYER_SPEED_PER_MS * deltaTime;
  }

  drawSquares();

  // socket.emit("movePlayer", { playerNum, keyData });
  // console.log(playerPositions);
  
  for (entry of Object.entries(playerPositions)) {
    if (entry[0] != playerNum) {
      //entry = [playerID, [[time, {x: 20, y: 20}], ...]]
      // console.log("ENTRY[1]:", entry[1]);
      const posQueue = entry[1];

      // console.log(curTime, (posQueue.length > 0) ? posQueue[0][0] : "NONE", INTERPOLATION_DISPLAY_MS, posQueue.length > 0 && posQueue[0][0] < curTime - INTERPOLATION_DISPLAY_MS, curTime - INTERPOLATION_DISPLAY_MS);
      // console.log(posQueue.length > 0, posQueue[0][0] < curTime - INTERPOLATION_DISPLAY_MS, posQueue[0][0], curTime - INTERPOLATION_DISPLAY_MS);
      while (posQueue.length > 0 && posQueue[0][0] < curTime - INTERPOLATION_DISPLAY_MS) {
        posQueue.shift();
      }

      // console.log(posQueue.length);
      if (posQueue.length > 0) {
        // console.log(posQueue.shift()[1]);
        // displayPositions[entry[0]] = posQueue.shift()[1];

        if (posQueue.length == 1) {
          displayPositions[entry[0]] = posQueue[0][1];
        } else {
          const percentThru = ((curTime - INTERPOLATION_DISPLAY_MS) - posQueue[0][0]) / (posQueue[1][0] - posQueue[0][0]);
          const newX = (posQueue[1][1].x - posQueue[0][1].x) * percentThru + posQueue[0][1].x;
          const newY = (posQueue[1][1].y - posQueue[0][1].y) * percentThru + posQueue[0][1].y;
          displayPositions[entry[0]] = {x: newX, y: newY};
        }
      }
    }
  }

  clientPhysicsLoopVar = setTimeout(() => clientPhysicsLoop(curTime), 15);
  //TODO: Change this to RequestAnimationFrame
}

clientPhysicsLoop(Date.now());
