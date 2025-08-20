const axios = require("axios");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const News = require("../models/News"); // Your Mongoose news model

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/yourdbname";

async function fetchAndSaveNews() {
  await mongoose.connect(MONGO_URI);

  // Example: Fetch news from Crypto News API (replace with your API key and preferred endpoint)
  const apiKey = "YOUR_API_KEY";
  const url = `https://cryptonews-api.com/api/v1?tickers=BTC,ETH&items=10&token=${apiKey}`;

  try {
    const res = await axios.get(url);
    const articles = res.data.data || [];
    
    for (const article of articles) {
      // Prevent duplicates using the article URL
      const exists = await News.findOne({ url: article.url });
      if (!exists) {
        await News.create({
          headline: article.title,
          summary: article.text || article.description || "",
          url: article.url,
          publishedAt: new Date(article.date || article.published_at || Date.now())
        });
      }
    }
    console.log("Crypto news fetched and saved!");
  } catch (err) {
    console.error("Error fetching news", err);
  } finally {
    mongoose.disconnect();
  }
}

fetchAndSaveNews();