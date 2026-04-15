import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import BibleBoard from './pages/BibleBoard';
import CrossReferences from './pages/CrossReferences';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/crossreferences" replace />} />
          <Route path="bible-board" element={<BibleBoard />} />
          <Route path="Bible board" element={<Navigate to="/bible-board" replace />} />
          <Route path="crossreferences" element={<CrossReferences />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
