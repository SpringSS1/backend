/**
 * Server Entry Point - Premium Professional Refactor
 */
const mongoose = require("mongoose");
const config = require("./config");
const app = require("./app");

if (!config.mongoUri) {
  console.error("❌ MONGO_URI is not set in your .env file!");
  process.exit(1);
}

console.log("Connecting to MongoDB:", config.mongoUri);

mongoose.connect(config.mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ MongoDB Connected");
    app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err);
    process.exit(1);
  });