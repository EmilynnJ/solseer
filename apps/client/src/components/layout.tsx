import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Globe2,
  Heart,
  LogOut,
  Menu,
  MessageCircle,
  UserRound,
  X,
} from "lucide-react";
import { authClient } from "../lib/auth";
import { posthog } from "../lib/posthog";
import { useSoulAuth } from "./auth-context";

const nav = [
  ["Readers", "/readers"],
  ["Community", "/community"],
  ["About", "/about"],
  ["Help", "/help"],
] as const;

export function Layout() {
  const [open, setOpen] = useState(false);
  const { me, sessionUser } = useSoulAuth();
  const navigate = useNavigate();
  async function signOut() {
    await authClient.signOut();
    posthog.reset();
    await navigate("/");
  }
  return (
    <div className="site-frame">
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="site-header">
        <button
          className="nav-toggle"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav
          className={`primary-nav ${open ? "open" : ""}`}
          aria-label="Primary"
        >
          {nav.slice(0, 2).map(([label, href]) => (
            <NavLink
              key={href}
              onClick={() => {
                setOpen(false);
              }}
              to={href}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <Link className="wordmark" to="/" aria-label="SoulSeer home">
          SoulSeer<span>✦</span>
        </Link>
        <nav
          className={`primary-nav nav-right ${open ? "open" : ""}`}
          aria-label="Account and information"
        >
          {nav.slice(2).map(([label, href]) => (
            <NavLink
              key={href}
              onClick={() => {
                setOpen(false);
              }}
              to={href}
            >
              {label}
            </NavLink>
          ))}
          {sessionUser ? (
            <>
              {me?.user.role !== "admin" && (
                <NavLink to="/messages" aria-label="Messages">
                  <MessageCircle size={17} /> Messages
                </NavLink>
              )}
              <NavLink to="/dashboard" aria-label="Dashboard">
                <UserRound size={17} /> {me?.user.username ?? "Dashboard"}
              </NavLink>
              <button
                className="nav-action"
                onClick={() => {
                  void signOut();
                }}
              >
                <LogOut size={16} /> Sign out
              </button>
            </>
          ) : (
            <NavLink className="nav-login" to="/login">
              Enter
            </NavLink>
          )}
        </nav>
      </header>
      <main id="content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div>
          <Link className="wordmark footer-mark" to="/">
            SoulSeer
          </Link>
          <p>Ethical guidance. Heart-centered connection.</p>
        </div>
        <div className="footer-links">
          <Link to="/privacy">Privacy</Link>
          <Link to="/help">Help</Link>
          <a
            href={
              import.meta.env.VITE_FACEBOOK_GROUP_URL ||
              "https://www.facebook.com"
            }
            target="_blank"
            rel="noreferrer"
          >
            <Globe2 size={16} /> Facebook
          </a>
          <a
            href={
              import.meta.env.VITE_DISCORD_INVITE_URL || "https://discord.com"
            }
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={16} /> Discord
          </a>
        </div>
        <p className="copyright">
          <Heart size={13} /> Spiritual guidance is for personal insight and
          entertainment; it is not medical, legal, or financial advice. ©{" "}
          {new Date().getFullYear()} SoulSeer.
        </p>
      </footer>
    </div>
  );
}
