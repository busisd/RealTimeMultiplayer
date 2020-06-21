const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const port = 3000;

app.use(express.static("public"));

app.get("/", (req, res) =>
  res.sendFile("public/index.html", { root: __dirname })
);

io.on("connection", (socket) => {
  console.log("user connected");

  socket.on('movePlayer', (data) => {
    switch(data) {
      case "up":
        y -= 5;
        break;
      case "right":
        x += 5;
        break;
      case "down":
        y += 5;
        break;
      case "left":
        x -= 5;
        break;
    }
  });

  socket.on("disconnect", () => console.log("user disconnected"));
});
io.on("disconnect", (socket) => console.log("user connected"));

http.listen(3000, () =>
  console.log(`Multiplayer app listening at http://localhost:${port}`)
);

var x = 20,
  y = 20;

var serverLoopVar;
function serverLoop() {
  // io.emit('printChar', 'L');
  // x += 1;
  // y += 1;
  io.emit("updatePos", { x, y });
  serverLoopVar = setTimeout(serverLoop, 45);
}

serverLoop();



