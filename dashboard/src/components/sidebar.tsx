"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Terminal,
  ScrollText,
  Archive,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { RalphStatusIndicator } from "./ralph-status-indicator";

const navItems = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/stories", label: "用户故事", icon: BookOpen },
  { href: "/terminal", label: "终端", icon: Terminal },
  { href: "/logs", label: "日志", icon: ScrollText },
  { href: "/archives", label: "归档", icon: Archive },
];

function NavContent() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Logo + project name */}
      <div className="px-4 py-5">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">Ralph</h1>
        <p className="text-xs text-zinc-400 mt-0.5">项目控制台</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? "bg-zinc-800/50 text-white"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-gradient-to-b from-cyan-500 to-blue-500" />
              )}
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        <Separator className="my-3 bg-zinc-800" />

        <Link
          href="/settings"
          className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ${
            pathname === "/settings"
              ? "bg-zinc-800/50 text-white"
              : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
          }`}
        >
          {pathname === "/settings" && (
            <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-gradient-to-b from-cyan-500 to-blue-500" />
          )}
          <Settings className="h-4 w-4" />
          设置
        </Link>
      </nav>

      {/* Status indicator at bottom */}
      <div className="px-4 py-4 border-t border-transparent" style={{ borderImage: 'linear-gradient(to right, #06B6D4, transparent) 1' }}>
        <RalphStatusIndicator />
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-zinc-950 border-r border-zinc-800 shrink-0">
        <NavContent />
      </aside>

      {/* Mobile hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center h-14 px-4 bg-zinc-950 border-b border-zinc-800">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-zinc-400">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0 bg-zinc-950 border-zinc-800">
            <div onClick={() => setOpen(false)}>
              <NavContent />
            </div>
          </SheetContent>
        </Sheet>
        <h1 className="ml-3 text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">Ralph</h1>
      </div>
    </>
  );
}
