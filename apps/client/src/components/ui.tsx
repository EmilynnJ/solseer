import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { LoaderCircle, Star } from "lucide-react";

export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`} {...props} />;
}

export function PageIntro({
  eyebrow,
  title,
  children,
}: PropsWithChildren<{ eyebrow?: string; title: string }>) {
  return (
    <header className="page-intro reveal">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children && <div className="lede">{children}</div>}
    </header>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  const ariaLabel =
    count !== undefined
      ? `${value.toFixed(1)} out of 5 stars (${count} review${count === 1 ? "" : "s"})`
      : `${value.toFixed(1)} out of 5 stars`;
  return (
    <span className="stars" aria-label={ariaLabel}>
      <Star size={15} fill="currentColor" aria-hidden="true" />{" "}
      {value.toFixed(1)}
      {count !== undefined && ` (${count})`}
    </span>
  );
}

export function Empty({
  icon,
  title,
  children,
}: PropsWithChildren<{ icon?: ReactNode; title: string }>) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> {label}
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
}: PropsWithChildren<{ tone?: "info" | "error" | "success" }>) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: PropsWithChildren<{ title: string; onClose: () => void }>) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
