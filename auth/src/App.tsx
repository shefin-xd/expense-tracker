import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Forgot from './pages/Forgot';
import Login from './pages/Login';
import Register from './pages/Register';
import Reset from './pages/Reset';

/** Unknown paths (including "/") go to sign-in and keep the ?redirect= choice. */
function ToLogin() {
  const { search } = useLocation();
  return <Navigate to={`/login${search}`} replace />;
}

export const AuthRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/forgot-password" element={<Forgot />} />
    <Route path="/reset-password" element={<Reset />} />
    <Route path="*" element={<ToLogin />} />
  </Routes>
);

export default function App() {
  return <BrowserRouter><AuthRoutes /></BrowserRouter>;
}
