const express = require("express");
const { setTimeout } = require("timers");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const _ = require("lodash")
const NanoTimer = require('nanotimer');
const timer = new NanoTimer();

/**
 * TODO:
 *  - better session management
 *    - eventually let users enter/claim usernames so they can reconnect
 *  - define game coordinates and let client side rendering convert that
 *  - use uuid
 *  - shared "physics" library for server and client
 *  - helper fxns for interpolation on client side
 *  - enable TS
 *  - always draw main player on top
 *  - add readme with explanation and screenshots
 *  - maybe:
 *    - switch server-side physics to use `while(oldTime + frameTime < newTime){...}`
 *    - keep a buffer of player inputs, received once per frame
 *      - apply them once per server-tick, and tell the client the ID of the latest one processed
 */

const port = 3000;

const PLAYER_SPEED_PER_MS = .25;
const SIMULATED_PING = 0;

app.use(express.static("public"));

app.get("/", (req, res) =>
  res.sendFile("public/index.html", { root: __dirname })
);

const playerPositions = {};
const playerInputs = {};
const playerColors = {};

io.on("connection", (socket) => {
  socket.data.playerId = _.random(100000000).toString();
  console.log(`User ${socket.data.playerId} connected`);

  playerPositions[socket.data.playerId] = { x: 20, y: 20 }
  playerInputs[socket.data.playerId] = { up: false, right: false, down: false, left: false }
  playerColors[socket.data.playerId] = _.random(0, 16777216)

  socket.emit('clientConnected', socket.data.playerId);
  io.emit('updatePlayerColors', playerColors);

  socket.on('updatePlayerInput', ({ keyData }) => {
    playerInputs[socket.data.playerId] = keyData;
  });

  socket.on('checkPingRequest', ({ requestId }) => {
    if (SIMULATED_PING > 0) {
      setTimeout(() => socket.emit('checkPingResponse', { requestId }), SIMULATED_PING);
    } else {
      socket.emit('checkPingResponse', { requestId });
    }
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

// Server-side physics loop and update messages

const SERVER_TICK_TIME_MICRO = Math.round(1000 * 1000 / 60);
let serverTime = performance.now();
let serverFrameNumber = 0;

const doPhysics = (deltaTime) => {
  for (entry of Object.entries(playerInputs)) {
    if (entry[0] > 0 && playerPositions[entry[0]]) {
      if (entry[1].up) playerPositions[entry[0]].y -= PLAYER_SPEED_PER_MS * deltaTime;
      if (entry[1].right) playerPositions[entry[0]].x += PLAYER_SPEED_PER_MS * deltaTime;
      if (entry[1].down) playerPositions[entry[0]].y += PLAYER_SPEED_PER_MS * deltaTime;
      if (entry[1].left) playerPositions[entry[0]].x -= PLAYER_SPEED_PER_MS * deltaTime;
    }
  }
}

const sendPositionUpdates = () => {
  if (SIMULATED_PING > 0) {
    const posToUpdate = _.cloneDeep(playerPositions);
    setTimeout(() => io.emit("updatePos", { playerPositions: posToUpdate, time: Date.now() }), 600);
  } else {
    io.emit("updatePos", { playerPositions, time: Date.now() });
  }
}

const serverTick = () => {
  const newServerTime = performance.now();
  serverFrameNumber++;

  doPhysics(newServerTime - serverTime);
  if (serverFrameNumber % 3 === 0) {
    sendPositionUpdates();
  }

  serverTime = newServerTime;
}

timer.setInterval(serverTick, '', `${SERVER_TICK_TIME_MICRO}u`);

