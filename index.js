const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const port = 3000;

const PLAYER_SPEED_PER_MS = .15; //Player speed per millisecond

app.use(express.static("public"));

app.get("/", (req, res) =>
  res.sendFile("public/index.html", { root: __dirname })
);

const playerPositions = {};
const playerInputs = {};
const playerColors = {};

const randRange = (min, max) => Math.floor(Math.random() * (max - min)) + min;

io.on("connection", (socket) => {
  let playerID = randRange(0, 100000);
  console.log(`user ${playerID} connected`);

  playerPositions[playerID] = {x: 20, y: 20}
  playerInputs[playerID] = {up: false, right: false, down: false, left: false}
  playerColors[playerID] = randRange(0, 16777216)
  socket.emit('clientConnected', playerID);
  io.emit('updatePlayerColors', playerColors);

  // socket.on('movePlayer', ({playerNum, keyData: {up, down, left, right}}) => {
  //   if (up)
  //     playerPositions[playerNum].y -= 2;
  //   if (right)
  //     playerPositions[playerNum].x += 2;
  //   if (down)
  //     playerPositions[playerNum].y += 2;
  //   if (left)
  //     playerPositions[playerNum].x -= 2;
  // });
  socket.on('updatePlayerInput', ({playerNum, keyData}) => {
    playerInputs[playerNum] = keyData;
  });

  socket.on("disconnect", () => {
    console.log(`user ${playerID} disconnected`);
    delete playerPositions[playerID];
    delete playerInputs[playerID];
    delete playerColors[playerID];
  });
});
// io.on("disconnect", (socket) => console.log("user connected"));

http.listen(port, '0.0.0.0', () =>
  console.log(`Multiplayer app listening at http://localhost:${port}`)
);

// var x = 20,
//   y = 20;

var serverLoopVar;
function serverLoop() {
  // io.emit('printChar', 'L');
  // x += 1;
  // y += 1;
  io.emit("updatePos", {playerPositions, time: Date.now()});
  serverLoopVar = setTimeout(serverLoop, 45);
}

var serverPhysicsLoopVar;
function serverPhysicsLoop(prevTime) {
  const curTime = Date.now();
  const deltaTime = curTime - prevTime;
  // console.log(deltaTime);

  for (entry of Object.entries(playerInputs)) {
    if (entry[0] > 0 && playerPositions[entry[0]]) {
      if (entry[1].up) playerPositions[entry[0]].y -= PLAYER_SPEED_PER_MS * deltaTime;
      if (entry[1].right) playerPositions[entry[0]].x += PLAYER_SPEED_PER_MS * deltaTime;
      if (entry[1].down) playerPositions[entry[0]].y += PLAYER_SPEED_PER_MS * deltaTime;
      if (entry[1].left) playerPositions[entry[0]].x -= PLAYER_SPEED_PER_MS * deltaTime; 
    }
  }

  serverPhysicsLoopVar = setTimeout(() => serverPhysicsLoop(curTime), 15);
}

serverLoop();
serverPhysicsLoop(Date.now());


