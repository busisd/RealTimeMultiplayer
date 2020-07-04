var socket = io();

const textP = document.getElementById("text");
var playerNum = -1;

socket.on("printChar", (data) => {
  console.log(data);
  textP.innerText += data;
});

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
var playerPositions;

function drawSquares() {
  gameGraphics.clear();
  gameGraphics.lineStyle(0, 0xff0000);
  gameGraphics.beginFill(0xff0000);

  if (playerPositions) {
    for (entry of Object.entries(playerPositions)) {
      gameGraphics.drawRect(entry[1].x, entry[1].y, 20, 20);
    }
  }
}

socket.on("clientConnected", (newPlayerNum) => {
  playerNum = newPlayerNum;
  console.log(playerNum);
});

socket.on("updatePos", (newPlayerPositions) => {
  // console.log(playerPositions, playerNum, playerPositions[playerNum]);
  playerPositions = newPlayerPositions;
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
});

var curTime = Date.now();
var clientLoopVar;
function clientLoop() {
  // console.log(Date.now() - curTime);
  // curTime = Date.now();

  if (keyData.up) playerPositions[playerNum].y -= 2;
  if (keyData.right) playerPositions[playerNum].x += 2;
  if (keyData.down) playerPositions[playerNum].y += 2;
  if (keyData.left) playerPositions[playerNum].x -= 2;

  drawSquares();

  socket.emit("movePlayer", { playerNum, keyData });
  clientLoopVar = setTimeout(clientLoop, 15);
}

clientLoop();
