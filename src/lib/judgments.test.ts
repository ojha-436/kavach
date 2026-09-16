import { describe, it, expect } from "vitest";
import {
  splitIntoParagraphs,
  prepareJudgmentText,
  deriveCourt,
  deriveCaseNumber,
} from "./judgments";

/** Shaped like a real Supreme Court Reports PDF after text extraction. */
const SCR_REPORT = `[2024] 10 S.C.R. 1503 : 2024 INSC 827

International Seaport Dredging Pvt Ltd

v.

Kamarajar Port Limited

(Civil Appeal No. 12097 of 2024)

04 October 2024

Issue for Consideration

Whether the High Court was justified in directing a bank guarantee.

Headnotes
†

Arbitration and Conciliation Act 1996 - ss.36, 34 - editorial summary text
that belongs to the law report and not to the court.

Case Law Cited

Pam Developments Private Limited v. State of West Bengal [2019] 8 SCR 1

List of Acts

Arbitration and Conciliation Act 1996.

List of Keywords

Stay on execution of award; Bank guarantee.

CIVIL APPELLATE JURISDICTION: Civil Appeal No. 12097 of 2024

Appearances for Parties

Shyam Divan, Sr. Adv., for the appellant.

1. Leave granted.

2. The appeal arises from an interim order dated 9 September 2024 of a Single
Judge of the High Court of Judicature at Madras.

3. The respondent issued a Letter of Award for executing Capital Dredging
Phase-III at Kamarajar Port to the appellant.

4. The arbitral tribunal rendered an award in favour of the appellant.

Result of the case: Appeal Allowed.

†
Headnotes prepared by: Nidhi Jain`;

describe("prepareJudgmentText", () => {
  it("strips law-report editorial matter, which is separately copyrighted", () => {
    const { body, strippedEditorial } = prepareJudgmentText(SCR_REPORT);

    expect(strippedEditorial).toBe(true);
    expect(body).not.toMatch(/Headnotes/i);
    expect(body).not.toMatch(/Case Law Cited/i);
    expect(body).not.toMatch(/List of Keywords/i);
    expect(body).not.toMatch(/Appearances for Parties/i);
    expect(body).not.toMatch(/Result of the case/i);
    expect(body).not.toMatch(/Headnotes prepared by/i);
  });

  it("starts the body at the judgment's first numbered paragraph", () => {
    const { body } = prepareJudgmentText(SCR_REPORT);
    expect(body.trimStart().startsWith("1. Leave granted.")).toBe(true);
  });

  it("keeps the party block in the header for titling", () => {
    const { header } = prepareJudgmentText(SCR_REPORT);
    expect(header).toContain("International Seaport Dredging");
    expect(header).toContain("Kamarajar Port Limited");
  });

  it("passes through a bare judgment that has no editorial apparatus", () => {
    const bare = "1. Leave granted.\n\n2. This is a plain judgment PDF.\n\n3. Ordered.";
    const { body, strippedEditorial } = prepareJudgmentText(bare);
    expect(strippedEditorial).toBe(false);
    expect(body).toBe(bare);
  });

  it("FAILS CLOSED when editorial matter exists but the body cannot be located", () => {
    // Publishing someone else's copyrighted headnotes is worse than skipping
    // a judgment, so this must throw rather than ingest.
    const truncated = SCR_REPORT.slice(0, SCR_REPORT.indexOf("1. Leave granted."));
    expect(() => prepareJudgmentText(truncated)).toThrow(/refusing to ingest/i);
  });
});

describe("splitIntoParagraphs", () => {
  it("uses the judgment's OWN paragraph numbers, not a synthetic sequence", () => {
    // Regression: indices were previously off by one because the short
    // opening paragraph was dropped, so a citation to para 14 resolved to 15.
    const { body } = prepareJudgmentText(SCR_REPORT);
    const paras = splitIntoParagraphs(body);

    expect(paras[0].index).toBe(1);
    expect(paras[0].text).toMatch(/^1\. Leave granted\./);
    for (const p of paras) {
      expect(p.text.trimStart().startsWith(`${p.index}.`)).toBe(true);
    }
  });

  it("keeps a very short opening paragraph rather than shifting every number", () => {
    const { body } = prepareJudgmentText(SCR_REPORT);
    const paras = splitIntoParagraphs(body);
    expect(paras.some((p) => p.text.includes("Leave granted"))).toBe(true);
  });

  it("offsets slice back to exactly the paragraph text", () => {
    const { body } = prepareJudgmentText(SCR_REPORT);
    for (const p of splitIntoParagraphs(body)) {
      expect(body.slice(p.startOffset, p.endOffset)).toBe(p.text);
    }
  });

  it("falls back to blank-line blocks when there is no usable numbering", () => {
    const unnumbered =
      "The court considered the matter at length and reached a conclusion.\n\n" +
      "It then turned to the question of costs and made an order accordingly.\n\n" +
      "Finally it disposed of the pending applications before it.";
    const paras = splitIntoParagraphs(unnumbered);
    expect(paras.length).toBeGreaterThanOrEqual(3);
    expect(paras[0].index).toBe(1);
  });
});

describe("deriveCourt", () => {
  it("always trusts the Supreme Court source over the text", () => {
    // Regression: SC judgments discuss the High Court order under appeal at
    // length, which previously misfiled 7 of 11 of them as High Court cases.
    expect(deriveCourt(SCR_REPORT, "sc")).toBe("Supreme Court of India");
  });

  it("reads the specific High Court from a High Court judgment", () => {
    const hc = "IN THE HIGH COURT OF JUDICATURE AT PATNA\n\nCriminal Appeal No. 1 of 2024";
    expect(deriveCourt(hc, "hc")).toBe("High Court of Patna");
  });

  it("sentence-cases a court name set in capitals", () => {
    const hc = "IN THE HIGH COURT OF JAMMU & KASHMIR AND LADAKH   \n\n1. Heard.";
    expect(deriveCourt(hc, "hc")).toBe("High Court of Jammu & Kashmir and Ladakh");
  });

  it("says so rather than guessing when the High Court is unnamed", () => {
    expect(deriveCourt("1. Some text with no court header.", "hc")).toBe(
      "High Court (unspecified)"
    );
  });
});

describe("deriveCaseNumber", () => {
  it("extracts the case number as stated", () => {
    expect(deriveCaseNumber(SCR_REPORT)).toBe("Civil Appeal No. 12097 of 2024");
  });

  it("returns null rather than inventing one", () => {
    expect(deriveCaseNumber("1. Leave granted.\n\n2. Nothing here.")).toBeNull();
  });
});
