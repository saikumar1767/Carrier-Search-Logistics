import express from "express";
import fetch from "node-fetch";
import cheerio from "cheerio";
const app = express();
const port = 3001; // Choose a different port than your React app

// Add CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000"); // Update with your React app's origin
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Proxy endpoint for fetching team data
app.get("/api/:dotNumber", async (req, res) => {
  try {
    console.log("Entered");

    const dotNumber = req.params.dotNumber;
    console.log(dotNumber);
    const response = await fetch(
      `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${dotNumber}`
    );

    const html = await response.text();
    const $ = cheerio.load(html);
    const phoneNumber = $('th:contains("Phone:")').next().text().trim();
    console.log(phoneNumber);
    res.json({ phoneNumber });
  } catch (error) {
    console.error("Error fetching phone number:", error);
    res.json({ phoneNumber: "" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
