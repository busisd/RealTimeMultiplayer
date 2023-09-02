const express = require("express");
const { setTimeout } = require("timers");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const _ = require("lodash")

/**
 * TODO:
 *  - nanotimer
 *  - better session management
 *    - eventually let users enter/claim usernames so they can reconnect
 *  - revamp what data is sent from server-to-client
 *  - make sure disconnected users disappear
 *  - consolidate server loop
 *  - define game coordinates and let client side rendering convert that
 *  - use uuid
 *  - client-side fps counter
 *  - shared "physics" library for server and client
 *  - track moves per-frame, then use latency + server-time to discard old moves
 *    and recalculate whenever the server updates
 *    - Use for server-predicted-position
 *  - helper fxns for interpolation on client side
 *  - enable TS
 *  - maybe:
 *    - Keep a buffer of player inputs, received once per frame
 *      - Apply them once per server-tick, and tell the client the ID of the latest one processed
 */

const port = 3000;

const PLAYER_SPEED_PER_MS = .25; //Player speed per millisecond

app.use(express.static("public"));

app.get("/", (req, res) =>
  res.sendFile("public/index.html", { root: __dirname })
);

const playerPositions = {};
const playerInputs = {};
const playerColors = {};

const randRange = (min, max) => Math.floor(Math.random() * (max - min)) + min;

io.on("connection", (socket) => {
  socket.data.playerId = randRange(0, 100000000).toString();
  console.log(`User ${socket.data.playerId} connected`);

  playerPositions[socket.data.playerId] = {x: 20, y: 20}
  playerInputs[socket.data.playerId] = {up: false, right: false, down: false, left: false}
  playerColors[socket.data.playerId] = randRange(0, 16777216)

  socket.emit('clientConnected', socket.data.playerId);
  io.emit('updatePlayerColors', playerColors);

  socket.on('updatePlayerInput', ({keyData}) => {
    playerInputs[socket.data.playerId] = keyData;
  });

  socket.on('checkPingRequest', ({ requestId }) => {
    socket.emit('checkPingResponse', { requestId })
  })

  socket.on("disconnect", () => {
    console.log(`user ${socket.data.playerId} disconnected`);
    delete playerPositions[socket.data.playerId];
    delete playerInputs[socket.data.playerId];
    delete playerColors[socket.data.playerId];
  });
});

http.listen(port, () =>
  console.log(`Multiplayer app listening on port: ${port}`)
);

var serverLoopVar;
function serverLoop() {
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


