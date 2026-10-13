# Policy source record

The policy pages copy the user-supplied documents, rather than introducing new legal terms.

| Route | Source | Pages checked |
| --- | --- | --- |
| `/privacy` | User-pasted Termly privacy-policy HTML | Full supplied HTML |
| `/acceptable-use` | `use.pdf` | 1–3 |
| `/accessibility` | Accessibility statement requested in follow-up | See original transcription below |
| `/eula` | `eula.pdf` | 1–5 |
| `/terms` | `termssoulseer.pdf` | 1–9 |

The PDFs contain screenshots, with no extractable text layer. Policy text was OCR-transcribed and visually checked. Dashboard navigation, upgrade prompts, browser print headers/footers, and floating controls are not policy content and were excluded. Paragraphs spanning pages were joined, and contents links point to the corresponding headings. The privacy policy's full text is preserved; presentation styles were removed so it can use the site's policy styling.

## Source limitations to resolve

All four PDF policies contain unfilled template fields. Visible blank lines are preserved as underscores; company details, contact details, dates, jurisdiction, arbitration values, and accessibility conformance claims have not been invented. Some sections, including EULA scope, technical requirements, and liability, have no body text in the screenshots.

On `use.pdf` page 1, Termly's floating “Get Started” control covers the end of the bullet beginning “Make improper use of our Services, including our support services”. The obscured part is marked `[text obscured in source screenshot]`. A clean source is needed to recover it verbatim.

The EULA table of contents says “NO MAINTENANCE AND SUPPORT”, while section 4 says “NO MAINTENANCE OR SUPPORT”. The website's generated contents list follows the section heading.

The user's follow-up replaces the footer entertainment disclaimer with an accessibility commitment and requests an accessibility statement. `/accessibility` now uses a completed statement with a WCAG 2.2 AA goal and the support email from the supplied privacy policy. It does not claim verified conformance. The original two-page `access.pdf` transcription is retained in `docs/accessibility-pdf-transcription.html`.

The new accessibility statement follows [W3C statement guidance](https://www.w3.org/WAI/planning/statements/) and [DOJ web accessibility guidance](https://www.ada.gov/resources/web-guidance/). A statement alone does not establish ADA compliance; the DOJ guidance does not prescribe universal statement wording for every website.

The policy HTML lives in `apps/client/src/content/policies/`. Treat these as reviewed static content; do not interpolate user input into the HTML renderer. The Termly resource blocker is loaded in `apps/client/index.html` before analytics with the user-supplied identifier and `autoBlock=on`.
