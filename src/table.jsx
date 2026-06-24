import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QRCodeSVG } from "qrcode.react";
import "./styles.css";

const TABLE_NUMBER = 7;

function TableQrPage() {
  // Le QR code pointe vers le menu hébergé sur la même adresse que cette page.
  // En se basant sur l'origine courante, il s'adapte automatiquement à
  // l'adresse finale (Render, domaine perso, etc.) sans rien changer ici.
  const [menuUrl, setMenuUrl] = useState("");

  useEffect(() => {
    setMenuUrl(`${window.location.origin}/?table=${TABLE_NUMBER}`);
  }, []);

  return (
    <div className="qr-page">
      <div className="qr-card">
        <p className="qr-brand">ClickOne</p>
        <h1 className="qr-title">Table {TABLE_NUMBER}</h1>

        <div className="qr-frame">
          {menuUrl && (
            <QRCodeSVG
              value={menuUrl}
              size={280}
              level="M"
              marginSize={2}
              bgColor="#ffffff"
              fgColor="#000000"
            />
          )}
        </div>

        <p className="qr-instruction">Scannez pour voir le menu</p>
        <p className="qr-hint">
          Ouvrez l'appareil photo de votre téléphone et visez le QR code
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TableQrPage />
  </React.StrictMode>,
);
