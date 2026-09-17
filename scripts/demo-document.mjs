/** Minimal single-file PDF writer: one page per ~46 lines, WinAnsi Helvetica. */
import { writeFileSync } from "node:fs";

const LINES = process.argv[3]
  ? null
  : null;

const text = `EMPLOYMENT OFFER LETTER

Kestrel Analytics Private Limited
Registered office: 4th Floor, Prestige Tech Park, Bengaluru 560103
Date: 4 September 2026

Dear Ms. Ananya Rao,

We are pleased to offer you the position of Senior Data Analyst at Kestrel
Analytics Private Limited on the terms set out below.

1. Position and Commencement. You shall serve as Senior Data Analyst,
reporting to the Head of Analytics. Your employment shall commence on
1 October 2026.

2. Remuneration. Your total cost to company shall be INR 18,00,000 per annum,
payable monthly in arrears, subject to deduction of tax at source.

3. Probation. You shall be on probation for a period of twelve (12) months
from the date of joining. During probation the Company may terminate your
employment without notice and without assigning any reason.

4. Working Hours. You shall work such hours as are necessary for the proper
discharge of your duties, and shall not be entitled to any overtime,
compensatory off, or additional payment for work on weekly offs or public
holidays.

5. Notice Period. You shall give the Company ninety (90) days written notice
to resign. The Company may terminate your employment on seven (7) days notice
or payment in lieu thereof.

6. Non-Competition. You shall not, for a period of twenty-four (24) months
following cessation of employment for any reason, directly or indirectly
engage with, consult for, be employed by, or hold any interest in any business
which competes with the Company anywhere within the territory of India.

7. Non-Solicitation. For twenty-four (24) months after cessation of
employment, you shall not solicit any employee, client or vendor of the
Company.

8. Confidentiality. You shall keep confidential all information relating to
the Company, including the terms of this letter and your remuneration, and
shall not discuss your salary with any other employee of the Company.

9. Intellectual Property. All work product, inventions and improvements made
by you during your employment, whether or not made using Company resources and
whether or not related to the Company's business, shall vest absolutely in the
Company.

10. Training Bond. Should you resign within twenty-four (24) months of
joining, you shall forthwith pay the Company INR 3,00,000 towards training
costs, which the Company may recover by deduction from any amounts due to you.

11. Dispute Resolution. Any dispute arising out of this letter shall be
referred to arbitration by a sole arbitrator appointed by the Company, seated
at Bengaluru.

12. Governing Law. This letter shall be governed by the laws of India and the
courts at Bengaluru shall have exclusive jurisdiction.

Please sign and return a copy of this letter to signify your acceptance.

For Kestrel Analytics Private Limited

Authorised Signatory`;

const lines = text.split("\n");
const PER_PAGE = 46;
const pages = [];
for (let i = 0; i < lines.length; i += PER_PAGE) pages.push(lines.slice(i, i + PER_PAGE));

const BS = String.fromCharCode(92);
const esc = (s) => s.split(BS).join(BS + BS).split("(").join(BS + "(").split(")").join(BS + ")");

const objects = [];
const add = (body) => { objects.push(body); return objects.length; };

// 1 catalog, 2 pages tree, 3 font — reserve ids by ordering.
const catalogId = 1, pagesId = 2, fontId = 3;
objects.push(null, null, null); // placeholders

const pageIds = [];
for (const pageLines of pages) {
  let stream = "BT\n/F1 10.5 Tf\n14 TL\n1 0 0 1 56 780 Tm\n";
  for (const line of pageLines) stream += `(${esc(line)}) Tj T*\n`;
  stream += "ET";
  const contentId = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  const pageId = add(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] ` +
    `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
  );
  pageIds.push(pageId);
}

objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
objects[fontId - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;

let pdf = "%PDF-1.4\n";
const offsets = [0];
objects.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf, "latin1"));
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xrefAt = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let i = 1; i <= objects.length; i++) {
  pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

writeFileSync(process.argv[2], Buffer.from(pdf, "latin1"));
console.log("wrote", process.argv[2], "pages:", pages.length);
