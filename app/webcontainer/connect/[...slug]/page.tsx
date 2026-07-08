"use client";

import { useEffect } from "react";

export default function WebContainerConnectPage() {
  useEffect(() => {
    // Dynamically import @webcontainer/api/connect to ensure it runs only in the browser context
    import("@webcontainer/api/connect")
      .then(({ setupConnect }) => {
        try {
          setupConnect();
        } catch (err) {
          console.error("Failed to run setupConnect:", err);
        }
      })
      .catch((err) => {
        console.error("Failed to import @webcontainer/api/connect:", err);
      });
  }, []);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      fontFamily: "system-ui, -apple-system, sans-serif",
      backgroundColor: "#09090b",
      color: "#f4f4f5"
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: "28px",
          height: "28px",
          border: "3px solid #27272a",
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          margin: "0 auto 16px"
        }} />
        <h2 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 6px 0", color: "#f4f4f5" }}>
          Connecting to Workspace...
        </h2>
        <p style={{ fontSize: "13px", color: "#a1a1aa", margin: 0, maxWidth: "280px" }}>
          Setting up proxy tunnels to render preview in this tab.
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
