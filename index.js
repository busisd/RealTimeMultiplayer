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

  socket.on('movePlayer', ({up, down, left, right}) => {
    if (up)
      y -= 2;
    if (right)
      x += 2;
    if (down)
      y += 2;
    if (left)
      x -= 2;
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



