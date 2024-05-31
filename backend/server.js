import express from "express";
import fetch from "node-fetch";
import cheerio from "cheerio";
import fileUpload from "express-fileupload";
import axios from "axios";
import { createObjectCsvWriter } from "csv-writer";

const app = express();
const port = 3001;
const API_KEY = "";

// Middleware
app.use(fileUpload());
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

const processCSV = (file) => {
  return new Promise((resolve, reject) => {
    const content = file.data.toString("utf8");
    const dotNumbers = content.split("\n").map((line) => line.split(",")[0]);
    resolve(dotNumbers.filter((dotNumber) => !!dotNumber));
  });
};

const fetchMCNumber = async (dotNumber) => {
  const apiUrl = `https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}/docket-numbers?webKey=${API_KEY}`;
  try {
    const response = await axios.get(apiUrl);
    const docketNumber = response.data.content[0]?.docketNumber;
    const prefix = response.data.content[0]?.prefix;
    return docketNumber && prefix ? `${prefix}${docketNumber}` : undefined;
  } catch (error) {
    return undefined;
  }
};

const fetchCarrierOperation = async (dotNumber) => {
  const apiUrl = `https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}/operation-classification?webKey=${API_KEY}`;
  try {
    const response = await axios.get(apiUrl);
    const operationClassDesc = response.data.content[0]?.operationClassDesc;
    return operationClassDesc;
  } catch (error) {
    return undefined;
  }
};

const fetchCargoCarried = async (dotNumber) => {
  const apiUrl = `https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}/cargo-carried?webKey=${API_KEY}`;
  try {
    const response = await axios.get(apiUrl);
    const cargoClassDesc = response.data.content[0]?.cargoClassDesc;
    return cargoClassDesc;
  } catch (error) {
    return undefined;
  }
};

const scrapePhoneNumber = async (dotNumber) => {
  if (!dotNumber || dotNumber.length <= 0) return undefined;
  const apiUrl = `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${dotNumber}`;
  try {
    const response = await fetch(apiUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    const phoneNumber = $('th:contains("Phone:")').next().text().trim();
    return phoneNumber.replace(/\D/g, "") || "";
  } catch (error) {
    return undefined;
  }
};

const fetchCarrierDetails = async (dotNumber) => {
  const apiUrl = `https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}?webKey=${API_KEY}`;
  try {
    const response = await axios.get(apiUrl);
    const carrier = response.data.content.carrier;
    const mcNumber = await fetchMCNumber(dotNumber);
    const carrierOperation = await fetchCarrierOperation(dotNumber);
    const cargoCarried = await fetchCargoCarried(dotNumber);
    const phone = await scrapePhoneNumber(dotNumber);
    if (carrier) {
      return {
        carrierName: carrier.legalName || carrier.dbaName,
        dotNumber: carrier.dotNumber,
        mcNumber: mcNumber,
        usdotStatus: carrier.statusCode === "A" ? "Active" : "Inactive",
        phone: phone || "",
        physicalAddress: `${carrier.phyStreet}, ${carrier.phyCity}, ${carrier.phyState}, ${carrier.phyCountry}, ${carrier.phyZipcode}`,
        carrierOperation: carrierOperation,
        cargoCarried: cargoCarried,
      };
    }
    return null;
  } catch (error) {
    return null;
  }
};

app.post("/upload", async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).send("No files were uploaded.");
  }
  const file = req.files.file;
  try {
    const dotNumbers = await processCSV(file);
    const carrierDetailsPromises = dotNumbers.map(fetchCarrierDetails);
    const allCarrierDetails = await Promise.all(carrierDetailsPromises);
    const validCarrierDetails = allCarrierDetails.filter(
      (detail) => detail !== null
    );

    // Generate CSV
    const csvWriter = createObjectCsvWriter({
      path: "fmcsa_carrier_data.csv",
      header: [
        { id: "carrierName", title: "Carrier Name" },
        { id: "dotNumber", title: "DOT #" },
        { id: "mcNumber", title: "MC #" },
        { id: "usdotStatus", title: "USDOT Status" },
        { id: "phone", title: "Phone" },
        { id: "physicalAddress", title: "Physical Address" },
        { id: "carrierOperation", title: "Carrier Operation" },
        { id: "cargoCarried", title: "Cargo Carried" },
      ],
    });

    await csvWriter.writeRecords(validCarrierDetails);
    res.download("fmcsa_carrier_data.csv");
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).send("Error processing file.");
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
