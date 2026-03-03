import { Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "@/components/sidebar";
import { WebSocketProvider } from "@/components/websocket-provider";
import DashboardPage from "@/pages/dashboard";
import StoriesPage from "@/pages/stories";
import TerminalPage from "@/pages/terminal";
import LogsPage from "@/pages/logs";
import ArchivesPage from "@/pages/archives";
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
        path="/stories"
        element={
          <DashboardLayout>
            <StoriesPage />
          </DashboardLayout>
        }
      />
      <Route
        path="/terminal"
        element={
          <DashboardLayout>
            <TerminalPage />
          </DashboardLayout>
        }
      />
      <Route
        path="/logs"
        element={
          <DashboardLayout>
            <LogsPage />
          </DashboardLayout>
        }
      />
      <Route
        path="/archives"
        element={
          <DashboardLayout>
            <ArchivesPage />
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
    </Routes>
  );
}
