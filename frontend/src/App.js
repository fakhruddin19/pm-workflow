import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Toaster } from "sonner";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProjectsPage from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Inbox from "./pages/Inbox";
import Landing from "./pages/Landing";
import "./App.css";

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Memuat...
      </div>
    );
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App grain-overlay">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/dashboard"
              element={
                <Protected>
                  <Dashboard />
                </Protected>
              }
            />
            <Route
              path="/projects"
              element={
                <Protected>
                  <ProjectsPage />
                </Protected>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <Protected>
                  <ProjectDetail />
                </Protected>
              }
            />
            <Route
              path="/inbox"
              element={
                <Protected>
                  <Inbox />
                </Protected>
              }
            />
          </Routes>
          <Toaster
            position="top-right"
            richColors
            theme="dark"
            toastOptions={{ style: { background: "#1F2937", border: "1px solid #374151", color: "#F9FAFB" } }}
          />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
