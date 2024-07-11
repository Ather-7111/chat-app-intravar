const { createMessage } = require("./actions/message");
const { createNotification } = require("./actions/notification");

const io = require("socket.io")(3000, {
  cors: {
    origin: "http://localhost:3001",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected --> id : ", socket.id);

  // When a user connects, join a unique room based on their user ID
  socket.on("register", (userId) => {
    socket.join(userId);
    console.log(
      `User registered with ID: ${userId} and joined room: ${userId}`
    );
  });

  socket.on("joinRoom", (roomName) => {
    socket.join(roomName);
    console.log(`User joined room: ${roomName}`);
  });

  socket.on("message", async (message) => {
    try {
      console.log("message received into socket-->", message);
      const savedMessage = await createMessage({
        text: message.text,
        chatId: message.chatId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        buffer: message.buffer,
        filetype: message.filetype,
        mime: message.attachementUrl,
      });

      const notification = await createNotification({
        chatId: message.chatId,
        messageId: savedMessage.id,
      });

      socket.broadcast.to(savedMessage.chatId).emit("message", savedMessage);

      io.to(savedMessage.receiverId).emit("notification", notification);
    } catch (error) {
      console.error("Failed to save & broadcast message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

console.log("Server is running on port 3000");
