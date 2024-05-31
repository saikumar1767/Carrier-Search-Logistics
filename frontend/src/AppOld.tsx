import React, { useState } from "react";
import axios from "axios";
import { CSVLink } from "react-csv";

interface CarrierData {
  carrierName: string;
  dotNumber: string;
  mcNumber?: string;
  usdotStatus: string;
  phone?: string;
  physicalAddress: string;
  carrierOperation?: string;
  cargoCarried?: string;
}

const App: React.FC = () => {
  const [carrierData, setCarrierData] = useState<CarrierData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const API_KEY = "";
  const processCSV = (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          const result = event.target.result as string;
          const dotNumbers = result
            .split("\n")
            .map((line) => line.split(",")[0]);
          resolve(dotNumbers);
        } else {
          reject("Error reading file");
        }
      };
      reader.onerror = () => {
        reject("Error reading file");
      };
      reader.readAsText(file);
    });
  };

  const fetchAllCarrierDetails = async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      let dotNumbers = await processCSV(file);
      dotNumbers = dotNumbers.filter((dotNumber) => !!dotNumber);

      const carrierDetailsPromises = dotNumbers.map((dotNumber) =>
        fetchCarrierDetails(dotNumber)
      );
      const allCarrierDetails = await Promise.all(carrierDetailsPromises);

      const validCarrierDetails = allCarrierDetails.filter(
        (detail) => detail !== null
      ) as CarrierData[];

      setCarrierData(validCarrierDetails);
    } catch (error) {
      setError("Error fetching carrier details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMCNumber = async (
    dotNumber: string
  ): Promise<string | undefined> => {
    const apiUrl = `https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}/docket-numbers?webKey=${API_KEY}`;

    try {
      const response = await axios.get(apiUrl);
      const docketNumber = response.data.content[0]?.docketNumber;
      const prefix = response.data.content[0]?.prefix;

      return docketNumber && prefix ? `${prefix}${docketNumber}` : undefined;
    } catch (error) {
      console.error(
        `Error fetching MC number for DOT number ${dotNumber}:`,
        error
      );
      return undefined;
    }
  };

  const fetchCarrierOperation = async (
    dotNumber: string
  ): Promise<string | undefined> => {
    const apiUrl = `https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}/operation-classification?webKey=${API_KEY}`;

    try {
      const response = await axios.get(apiUrl);
      const operationClassDesc = response.data.content[0]?.operationClassDesc;

      return operationClassDesc;
    } catch (error) {
      console.error(
        `Error fetching carrier operation for DOT number ${dotNumber}:`,
        error
      );
      return undefined;
    }
  };

  const fetchCargoCarried = async (
    dotNumber: string
  ): Promise<string | undefined> => {
    const apiUrl = `https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}/cargo-carried?webKey=${API_KEY}`;

    try {
      const response = await axios.get(apiUrl);
      const cargoClassDesc = response.data.content[0]?.cargoClassDesc;

      return cargoClassDesc;
    } catch (error) {
      console.error(
        `Error fetching cargo carried for DOT number ${dotNumber}:`,
        error
      );
      return undefined;
    }
  };

  const scrapePhoneNumber = async (
    dotNumber: string
  ): Promise<string | undefined> => {
    if (!dotNumber || dotNumber.length <= 0) return undefined;

    const apiUrl = `http://localhost:3001/api/${dotNumber}`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json(); // Parsing JSON response
      return data.phoneNumber?.replace(/\D/g, "") || "";
    } catch (error) {
      console.error(
        `Error scraping phone number for DOT number ${dotNumber}:`,
        error
      );
      return undefined;
    }
  };

  const fetchCarrierDetails = async (
    dotNumber: string
  ): Promise<CarrierData | null> => {
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
      console.error(
        `Error fetching details for DOT number ${dotNumber}:`,
        error
      );
      return null;
    }
  };

  return (
    <div style={{ width: "80%", margin: "auto" }}>
      <h1>FMCSA Carrier Data Fetcher</h1>
      <input
        type="file"
        onChange={(e) =>
          e.target.files && fetchAllCarrierDetails(e.target.files[0])
        }
      />
      {loading ? <p>Loading...</p> : null}
      {error && <p>{error}</p>}
      {carrierData.length > 0 && (
        <CSVLink
          data={carrierData}
          headers={[
            { label: "Carrier Name", key: "carrierName" },
            { label: "DOT #", key: "dotNumber" },
            { label: "MC #", key: "mcNumber" },
            { label: "USDOT Status", key: "usdotStatus" },
            { label: "Phone", key: "phone" },
            { label: "Physical Address", key: "physicalAddress" },
            { label: "Carrier Operation", key: "carrierOperation" },
            { label: "Cargo Carried", key: "cargoCarried" },
          ]}
          filename="fmcsa_carrier_data.csv"
        >
          Download CSV
        </CSVLink>
      )}
    </div>
  );
};

export default App;
