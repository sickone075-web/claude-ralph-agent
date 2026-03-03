import { Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "@/components/sidebar";
import { WebSocketProvider } from "@/components/websocket-provider";
import DashboardPage from "@/pages/dashboard";
import SettingsPage from "@/pages/settings";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebSocketProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto pt-14 md:pt-0">
          {children}
        </main>
      </div>
    </WebSocketProvider>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <DashboardLayout>
            <DashboardPage />
          </DashboardLayout>
        }
      />
      <Route
        path="/settings"
        element={
          <DashboardLayout>
            <SettingsPage />
          </DashboardLayout>
        }
      />
      {/* Redirect old routes to dashboard */}
      <Route path="/terminal" element={<Navigate to="/dashboard" replace />} />
      <Route path="/stories" element={<Navigate to="/dashboard" replace />} />
      <Route path="/logs" element={<Navigate to="/dashboard" replace />} />
      <Route path="/archives" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
