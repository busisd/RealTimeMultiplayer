const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const port = 3000;

app.use(express.static("public"));

app.get("/", (req, res) =>
  res.sendFile("public/index.html", { root: __dirname })
);

const playerPositions = {};

io.on("connection", (socket) => {
  playerID = Math.floor(Math.random() * 100000) + 1;
  console.log(`user ${playerID} connected`);

  playerPositions[playerID] = {x: 20, y: 20}
  socket.emit('clientConnected', playerID);

  socket.on('movePlayer', ({playerNum, keyData: {up, down, left, right}}) => {
    if (up)
      playerPositions[playerNum].y -= 2;
    if (right)
      playerPositions[playerNum].x += 2;
    if (down)
      playerPositions[playerNum].y += 2;
    if (left)
      playerPositions[playerNum].x -= 2;
  });

  socket.on("disconnect", () => {
    console.log(`user ${playerID} disconnected`);
    delete playerPositions[playerID];
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
  io.emit("updatePos", playerPositions);
  serverLoopVar = setTimeout(serverLoop, 45);
}

serverLoop();



