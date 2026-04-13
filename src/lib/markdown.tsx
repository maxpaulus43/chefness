/**
 * Lightweight Markdown renderer for chat messages.
 *
 * Pure rendering utility — no hooks, no state, no side effects.
 * Handles the common markdown patterns LLMs produce: headings, bold,
 * italic, lists, code blocks, inline code, horizontal rules.
 */
import React from "react";

// ---------------------------------------------------------------------------
// Inline parsing
// ---------------------------------------------------------------------------

/** Parse inline markdown (bold, italic, code) into React nodes. */
function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const inlineRe =
    /(`(.+?)`)|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|_(.+?)_/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = inlineRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const key = `${keyPrefix}-${i++}`;

    if (match[2] != null) {
      nodes.push(
        <code key={key} style={mdStyles.inlineCode}>{match[2]}</code>,
      );
    } else if (match[3] != null) {
      nodes.push(
        <strong key={key} style={mdStyles.bold}><em>{match[3]}</em></strong>,
      );
    } else if (match[4] != null) {
      nodes.push(
        <strong key={key} style={mdStyles.bold}>{match[4]}</strong>,
      );
    } else if (match[5] != null) {
      nodes.push(<em key={key}>{match[5]}</em>);
    } else if (match[6] != null) {
      nodes.push(<em key={key}>{match[6]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes.length > 0 ? nodes : [text];
}

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------

interface Block {
  type: "heading" | "code" | "hr" | "ul" | "ol" | "paragraph";
  level?: number;
  lang?: string;
  content: string;
  items?: string[];
}

function parseBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Fenced code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length) {
        if (lines[i]!.trimStart().startsWith("```")) { i++; break; }
        codeLines.push(lines[i]!);
        i++;
      }
      blocks.push({ type: "code", lang, content: codeLines.join("\n") });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1]!.length, content: headingMatch[2]! });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) { blocks.push({ type: "hr", content: "" }); i++; continue; }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", content: "", items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", content: "", items });
      continue;
    }

    // Blank line
    if (line.trim() === "") { i++; continue; }

    // Paragraph
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i]!;
      if (
        l.trim() === "" ||
        l.trimStart().startsWith("```") ||
        /^#{1,3}\s+/.test(l) ||
        /^---+\s*$/.test(l) ||
        /^[-*]\s+/.test(l) ||
        /^\d+\.\s+/.test(l)
      ) break;
      paraLines.push(l);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join("\n") });
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Markdown({
  content,
  style,
}: {
  content: string;
  style?: React.CSSProperties;
}): React.ReactElement {
  const blocks = parseBlocks(content);

  return (
    <div style={style}>
      {blocks.map((block, idx) => {
        const key = `b${idx}`;
        switch (block.type) {
          case "heading": {
            const Tag = (`h${Math.min(block.level ?? 1, 3)}`) as "h1" | "h2" | "h3";
            const fontSize =
              block.level === 1 ? "1.2rem" : block.level === 2 ? "1.1rem" : "1rem";
            return (
              <Tag key={key} style={{ ...mdStyles.heading, fontSize }}>
                {parseInline(block.content, key)}
              </Tag>
            );
          }
          case "code":
            return (
              <pre key={key} style={mdStyles.codeBlock}><code>{block.content}</code></pre>
            );
          case "hr":
            return <hr key={key} style={mdStyles.hr} />;
          case "ul":
            return (
              <ul key={key} style={mdStyles.list}>
                {block.items?.map((item, j) => (
                  <li key={`${key}-${j}`} style={mdStyles.listItem}>
                    {parseInline(item, `${key}-${j}`)}
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} style={mdStyles.list}>
                {block.items?.map((item, j) => (
                  <li key={`${key}-${j}`} style={mdStyles.listItem}>
                    {parseInline(item, `${key}-${j}`)}
                  </li>
                ))}
              </ol>
            );
          case "paragraph": {
            const segments = block.content.split("\n");
            return (
              <p key={key} style={mdStyles.paragraph}>
                {segments.map((seg, j) => (
                  <React.Fragment key={`${key}-${j}`}>
                    {j > 0 && <br />}
                    {parseInline(seg, `${key}-${j}`)}
                  </React.Fragment>
                ))}
              </p>
            );
          }
        }
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const mdStyles: Record<string, React.CSSProperties> = {
  heading: {
    fontWeight: 700,
    margin: "0.75em 0 0.25em",
    lineHeight: 1.3,
  },
  bold: { fontWeight: 600 },
  paragraph: { margin: "0.5em 0" },
  list: { paddingLeft: "1.25rem", margin: "0.5em 0" },
  listItem: { margin: "0.25em 0" },
  inlineCode: {
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    padding: "0.1em 0.35em",
    fontFamily: "monospace",
    fontSize: "0.9em",
  },
  codeBlock: {
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    padding: "0.75rem 1rem",
    overflowX: "auto",
    fontFamily: "monospace",
    fontSize: "0.85rem",
    margin: "0.5em 0",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  hr: {
    border: "none",
    borderTop: "1px solid #d1d5db",
    margin: "0.75em 0",
  },
};
