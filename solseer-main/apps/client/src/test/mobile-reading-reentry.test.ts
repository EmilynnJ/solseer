import { describe, expect, it } from "vitest";
import mainSource from "../main.tsx?raw";

describe("mobile reading re-entry styling", () => {
  it("loads the reading re-entry override after the base stylesheet", () => {
    const baseStyles = mainSource.indexOf('import "./styles.css";');
    const reentryStyles = mainSource.indexOf('import "./reading-reentry.css";');

    expect(baseStyles).toBeGreaterThan(-1);
    expect(reentryStyles).toBeGreaterThan(baseStyles);
  });
});
