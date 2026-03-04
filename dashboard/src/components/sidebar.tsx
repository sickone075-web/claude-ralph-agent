import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Settings } from "lucide-react";
import { RalphStatusIndicator } from "./ralph-status-indicator";

const navItems = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
];

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <>
      {/* Desktop sidebar - 64px icon rail */}
      <aside
        className="hidden md:flex w-16 flex-col items-center shrink-0"
        style={{
          backgroundColor: "#EDEDEA",
          borderRight: "1px solid #E0DDD5",
        }}
      >
        {/* Logo */}
        <div className="mt-4 mb-6">
          <div
            className="flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: "#C15F3C",
            }}
          >
            <span
              style={{
                color: "#FFFFFF",
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 20,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              R
            </span>
          </div>
        </div>

        {/* Separator */}
        <div
          className="w-8 mb-4"
          style={{ height: 1, backgroundColor: "#E0DDD5" }}
        />

        {/* Nav icons */}
        <nav className="flex-1 flex flex-col items-center gap-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                to={item.href}
                title={item.label}
                className="flex items-center justify-center transition-colors duration-200"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isActive ? "#C15F3C" : "transparent",
                  color: isActive ? "#FFFFFF" : "#999999",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "#ECEAE5";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>

        {/* Bottom section: Settings + Status */}
        <div className="flex flex-col items-center gap-3 mb-4">
          <Link
            to="/settings"
            title="设置"
            className="flex items-center justify-center transition-colors duration-200"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor:
                pathname === "/settings" ? "#C15F3C" : "transparent",
              color: pathname === "/settings" ? "#FFFFFF" : "#999999",
            }}
            onMouseEnter={(e) => {
              if (pathname !== "/settings") {
                e.currentTarget.style.backgroundColor = "#ECEAE5";
              }
            }}
            onMouseLeave={(e) => {
              if (pathname !== "/settings") {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <Settings className="h-5 w-5" />
          </Link>

          {/* Ralph status dot */}
          <RalphStatusIndicator compact />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center h-14 px-4"
        style={{
          backgroundColor: "#EDEDEA",
          borderBottom: "1px solid #E0DDD5",
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: "#C15F3C",
          }}
        >
          <span
            style={{
              color: "#FFFFFF",
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            R
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard"
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor:
                pathname === "/dashboard" ? "#C15F3C" : "transparent",
              color: pathname === "/dashboard" ? "#FFFFFF" : "#999999",
            }}
          >
            <LayoutDashboard className="h-4.5 w-4.5" />
          </Link>
          <Link
            to="/settings"
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor:
                pathname === "/settings" ? "#C15F3C" : "transparent",
              color: pathname === "/settings" ? "#FFFFFF" : "#999999",
            }}
          >
            <Settings className="h-4.5 w-4.5" />
          </Link>
        </div>
      </div>
    </>
  );
}
