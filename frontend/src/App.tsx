import React, { useState } from "react";

const App: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files) return;

    const file = event.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "FMCSA_carrier_data.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        setError("Failed to process the file.");
      }
    } catch (error) {
      setError("Error uploading file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: "80%", margin: "auto" }}>
      <h1>FMCSA Carrier Data Fetcher</h1>
      <input type="file" onChange={handleFileUpload} />
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
    </div>
  );
};

export default App;
