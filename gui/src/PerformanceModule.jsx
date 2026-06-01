import React from "react";
import HolographicGlobe from "./HolographicGlobe";

export default function PerformanceModule() {
  return (
    <div className="performance-module-page">
      <h1>Performance Module</h1>
      <div className="globe-wrapper">
        <HolographicGlobe drive={1} bass={1} treble={1} distortion={0} />
      </div>
    </div>
  );
}
