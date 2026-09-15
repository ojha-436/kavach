import { converse, type ConversationTurn, type ToolCall } from "./llm";
import { rulesFor, expectedClauseTypes } from "./rules";
import { DocType } from "./schema";
import { getAnalysis, listClauses, searchJudgments, getJudgment } from "./firestore-admin";
import { explainJudgment } from "./explain-judgment";

/**
 * The agent has no free-form legal answer path.
 *
 * It holds five tools and may only say what those tools returned. The
 * refusal path (`ask_a_lawyer`) is a tool rather than a failure mode, so
 * "I can't answer that, here is what to ask a lawyer" is a first-class,
 * intentional outcome rather than the model running out of ideas.
 */

const MAX_STEPS = 6;

const SYSTEM = `You are Kavach's legal information assistant for India.

WHAT YOU ARE
You help people understand Indian rental agreements, employment offer letters, and Supreme Court
judgments. You give legal INFORMATION. You never give legal advice.

THE RULE THAT OVERRIDES EVERYTHING
You have no legal knowledge of your own that you are permitted to use. Every factual or legal
statement you make must come from a tool result in this conversation. You may well "know" the
answer to a legal question. That knowledge is not admissible here. If no tool has returned
support for a statement, you may not make it.

If the tools do not answer the user's question, call ask_a_lawyer. Handing someone the right
question to put to a lawyer is a correct and valuable outcome, not a failure.

HOW TO WORK
- Call lookup_rule before saying anything about what Indian law provides.
- Call analyse_clause before saying anything about the user's own document.
- Call search_judgments then explain_judgment before saying anything about a court case. When a
  search returns a plausible match, call explain_judgment on it yourself — never ask the user for
  a judgment ID, and never describe a case from its title alone. A title is not a holding.
- Cite the statute and section a rule came from whenever you rely on it.
- Never predict how a court would decide anything.
- Never tell the user what to do about their specific situation. You can tell them what a clause
  says, what the statute says, and what to ask a lawyer.

HOW TO WRITE
Short sentences. Ordinary words. No legalese unless you immediately explain it. The person you
are talking to is worried about a contract they may have already signed. Be calm and concrete.`;

const FUNCTION_DECLARATIONS = [
  {
    name: "lookup_rule",
    description:
      "Look up curated Indian statutory rules for a kind of contract clause. This is the only permitted source for statements about what Indian law provides.",
    parameters: {
      type: "OBJECT",
      properties: {
        docType: { type: "STRING", enum: ["rental", "employment"] },
        clauseType: {
          type: "STRING",
          description:
            "Clause category, e.g. non_compete, security_deposit, lock_in_period. Omit to list every clause type available for that document type.",
        },
      },
      required: ["docType"],
    },
  },
  {
    name: "analyse_clause",
    description:
      "Fetch a clause from a document the user has uploaded in this session, with its text and any matched statutory rules.",
    parameters: {
      type: "OBJECT",
      properties: {
        analysisId: { type: "STRING" },
        clauseId: {
          type: "STRING",
          description: "Omit to list all clauses in the document.",
        },
      },
      required: ["analysisId"],
    },
  },
  {
    name: "search_judgments",
    description:
      "Search ingested Supreme Court of India judgments by subject or party name. Returns matches only; it never summarises.",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING" } },
      required: ["query"],
    },
  },
  {
    name: "explain_judgment",
    description:
      "Get a plain-English, paragraph-cited explanation of one judgment. Every point is checked against the judgment text before it is returned.",
    parameters: {
      type: "OBJECT",
      properties: { judgmentId: { type: "STRING" } },
      required: ["judgmentId"],
    },
  },
  {
    name: "ask_a_lawyer",
    description:
      "Use when the question turns on facts outside the documents available, needs advice, or no other tool supports an answer. Returns the precise question the user should put to a lawyer.",
    parameters: {
      type: "OBJECT",
      properties: {
        question: {
          type: "STRING",
          description: "The specific question a lawyer should be asked, in the user's own situation.",
        },
        why: {
          type: "STRING",
          description: "Why this cannot be answered from the documents available.",
        },
      },
      required: ["question", "why"],
    },
  },
];

async function runTool(call: ToolCall): Promise<unknown> {
  switch (call.name) {
    case "lookup_rule": {
      const parsed = DocType.safeParse(call.args.docType);
      if (!parsed.success) return { error: "docType must be rental or employment" };
      const clauseType = call.args.clauseType as string | undefined;
      if (!clauseType) {
        return {
          clauseTypes: expectedClauseTypes(parsed.data),
          note: "Call again with one of these clauseType values for the rules themselves.",
        };
      }
      const rules = rulesFor(parsed.data, clauseType);
      if (rules.length === 0) {
        return {
          rules: [],
          note: `No curated rule for '${clauseType}'. The rule pack is deliberately finite; treat this as 'not covered', not as 'lawful'.`,
          availableClauseTypes: expectedClauseTypes(parsed.data),
        };
      }
      return { rules };
    }

    case "analyse_clause": {
      const analysisId = call.args.analysisId as string;
      const analysis = await getAnalysis(analysisId);
      if (!analysis) return { error: "No such analysis in this session." };
      const clauses = await listClauses(analysisId);
      const clauseId = call.args.clauseId as string | undefined;

      if (!clauseId) {
        return {
          docTypeHint: analysis.docTypeHint,
          clauses: clauses.map((c) => ({
            id: c.id,
            heading: c.heading,
            clauseType: c.clauseType,
            preview: c.text.slice(0, 160),
          })),
        };
      }

      const clause = clauses.find((c) => c.id === clauseId);
      if (!clause) return { error: "No such clause." };
      const rules =
        analysis.docTypeHint && clause.clauseType
          ? rulesFor(analysis.docTypeHint, clause.clauseType)
          : [];
      return { clause, matchedRules: rules };
    }

    case "search_judgments": {
      const results = await searchJudgments(String(call.args.query ?? ""));
      if (results.length === 0) {
        return {
          results,
          note: "Nothing in the ingested corpus matches. The corpus is a curated subset of Supreme Court judgments, so absence here does not mean no such case exists. Tell the user that, and do not describe any case from memory.",
        };
      }
      return {
        results,
        // Results are ranked; without this the model tends to stop here and
        // ask the user to pick an ID, which exposes internal identifiers and
        // invites it to characterise a case from its title alone.
        nextStep: `Do NOT stop here and do NOT ask the user to choose. Results are ranked by relevance. Call explain_judgment on "${results[0].id}" now. If it turns out not to answer the question, try the next result before replying.`,
      };
    }

    case "explain_judgment": {
      const judgmentId = String(call.args.judgmentId ?? "");
      const record = await getJudgment(judgmentId);
      if (!record) return { error: "That judgment is not in the ingested corpus." };
      const { explanation, droppedClaims } = await explainJudgment(record.paragraphs);
      return {
        judgment: {
          id: record.judgment.id,
          title: record.judgment.title,
          citation: record.judgment.citation,
          year: record.judgment.year,
        },
        explanation,
        droppedClaims,
      };
    }

    case "ask_a_lawyer":
      return {
        question: call.args.question,
        why: call.args.why,
        instruction:
          "Present this to the user as the question to put to a lawyer. Do not attempt to answer it yourself.",
      };

    default:
      return { error: `Unknown tool ${call.name}` };
  }
}

export type AgentStep =
  | { type: "tool"; name: string; args: Record<string, unknown> }
  | { type: "answer"; text: string };

export async function runAgent(
  history: ConversationTurn[]
): Promise<{ steps: AgentStep[]; answer: string; turns: ConversationTurn[] }> {
  const steps: AgentStep[] = [];
  const working = [...history];

  for (let i = 0; i < MAX_STEPS; i++) {
    const turn = await converse({
      systemInstruction: SYSTEM,
      functionDeclarations: FUNCTION_DECLARATIONS,
      history: working,
    });

    if (turn.kind === "text") {
      steps.push({ type: "answer", text: turn.text });
      working.push({ role: "model", text: turn.text });
      return { steps, answer: turn.text, turns: working };
    }

    for (const call of turn.calls) {
      steps.push({ type: "tool", name: call.name, args: call.args });
      const result = await runTool(call);
      working.push({ role: "toolResult", name: call.name, result });
    }
  }

  const fallback =
    "I wasn't able to ground an answer to that in the documents and rules available. Ask a lawyer directly, and bring the document with you.";
  return { steps, answer: fallback, turns: working };
}
