import React from "react";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DonationApp } from "./donations/DonationApp";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DonationApp />} />
        <Route path="/donations/*" element={<DonationApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
