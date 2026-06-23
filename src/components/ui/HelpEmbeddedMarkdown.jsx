import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ecosystemFlowchartUrl from "../../assets/help/salt-ecosystem-flowchart.png?url";

const ink = "rgba(255, 250, 246, 0.92)";
const inkMuted = "rgba(255, 250, 246, 0.78)";
const mint = "#59C1A7";
const mintSoft = "#7dd3c0";
const surface = "rgba(255, 250, 246, 0.06)";
const border = "rgba(0, 90, 114, 0.35)";
const codeBg = "rgba(0, 24, 32, 0.55)";

const ECOSYSTEM_HEADING = "## How the ecosystem fits together";
/** Markdown image for GitHub; stripped in-app and replaced with Vite-bundled asset. */
const ECOSYSTEM_MD_IMG = /\n*!\[[^\]]*\]\([^)]*salt-ecosystem-flowchart\.png\)\s*\n?/gi;

const diagramImgStyle = {
  maxWidth: "100%",
  height: "auto",
  display: "block",
  margin: "0 0 14px",
  borderRadius: 10,
  border: `1px solid ${border}`,
  background: "rgba(255, 250, 246, 0.06)",
};

function linkProps(href) {
  const isHttp = typeof href === "string" && /^https?:\/\//i.test(href);
  return isHttp ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

function helpMarkdownUrlTransform(url) {
  if (typeof url !== "string" || !url) return url;
  if (url.startsWith("./public/")) return "/" + url.slice("./public/".length);
  if (url.startsWith("public/")) return "/" + url.slice("public/".length);
  return url;
}

function isEcosystemFlowchartRef(src) {
  if (typeof src !== "string") return false;
  return src.includes("salt-ecosystem-flowchart");
}

const mdComponents = {
  h1: ({ children, ...rest }) => (
    <h1
      {...rest}
      style={{
        margin: "0 0 12px",
        fontSize: 20,
        fontWeight: 950,
        letterSpacing: "0.02em",
        color: ink,
        borderBottom: `1px solid ${border}`,
        paddingBottom: 8,
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...rest }) => (
    <h2
      {...rest}
      style={{
        margin: "22px 0 10px",
        fontSize: 15,
        fontWeight: 950,
        letterSpacing: "0.04em",
        color: mintSoft,
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...rest }) => (
    <h3
      {...rest}
      style={{
        margin: "18px 0 8px",
        fontSize: 13,
        fontWeight: 950,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: mint,
      }}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...rest }) => (
    <h4 {...rest} style={{ margin: "14px 0 6px", fontSize: 13, fontWeight: 950, color: ink }}>
      {children}
    </h4>
  ),
  p: ({ children, ...rest }) => (
    <p {...rest} style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.55, fontWeight: 600, color: inkMuted }}>
      {children}
    </p>
  ),
  ul: ({ children, ...rest }) => (
    <ul {...rest} style={{ margin: "0 0 12px", paddingLeft: 20, color: inkMuted, fontWeight: 600, fontSize: 13, lineHeight: 1.55 }}>
      {children}
    </ul>
  ),
  ol: ({ children, ...rest }) => (
    <ol {...rest} style={{ margin: "0 0 12px", paddingLeft: 20, color: inkMuted, fontWeight: 600, fontSize: 13, lineHeight: 1.55 }}>
      {children}
    </ol>
  ),
  li: ({ children, ...rest }) => (
    <li {...rest} style={{ marginBottom: 4 }}>
      {children}
    </li>
  ),
  a: ({ href, children, ...rest }) => (
    <a
      {...rest}
      href={href}
      {...linkProps(href)}
      style={{ color: mintSoft, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}
    >
      {children}
    </a>
  ),
  strong: ({ children, ...rest }) => (
    <strong {...rest} style={{ color: ink, fontWeight: 950 }}>
      {children}
    </strong>
  ),
  em: ({ children, ...rest }) => (
    <em {...rest} style={{ color: "rgba(255, 250, 246, 0.88)", fontStyle: "italic" }}>
      {children}
    </em>
  ),
  hr: (props) => <hr {...props} style={{ border: "none", borderTop: `1px solid ${border}`, margin: "18px 0" }} />,
  blockquote: ({ children, ...rest }) => (
    <blockquote
      {...rest}
      style={{
        margin: "0 0 12px",
        padding: "10px 14px",
        borderLeft: `3px solid ${mint}`,
        background: surface,
        borderRadius: "0 10px 10px 0",
        color: inkMuted,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.5,
      }}
    >
      {children}
    </blockquote>
  ),
  code: ({ inline, children, ...rest }) =>
    inline ? (
      <code
        {...rest}
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: "0.92em",
          padding: "2px 6px",
          borderRadius: 6,
          background: codeBg,
          color: "#d5ff9f",
          fontWeight: 700,
        }}
      >
        {children}
      </code>
    ) : (
      <code
        {...rest}
        style={{
          display: "block",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: "transparent",
          color: "rgba(213, 255, 159, 0.92)",
          padding: 0,
        }}
      >
        {children}
      </code>
    ),
  pre: ({ children, ...rest }) => (
    <pre
      {...rest}
      style={{
        margin: "0 0 14px",
        padding: "12px 14px",
        borderRadius: 10,
        background: codeBg,
        border: `1px solid ${border}`,
        overflow: "auto",
        maxWidth: "100%",
      }}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...rest }) => (
    <div style={{ overflowX: "auto", margin: "0 0 14px", maxWidth: "100%" }}>
      <table {...rest} style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 480 }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...rest }) => <thead {...rest}>{children}</thead>,
  tbody: ({ children, ...rest }) => <tbody {...rest}>{children}</tbody>,
  tr: ({ children, ...rest }) => <tr {...rest}>{children}</tr>,
  th: ({ children, ...rest }) => (
    <th
      {...rest}
      style={{
        textAlign: "left",
        padding: "8px 10px",
        borderBottom: `1px solid ${mint}`,
        color: mintSoft,
        fontWeight: 950,
        background: "rgba(0, 40, 48, 0.35)",
      }}
    >
      {children}
    </th>
  ),
  img: ({ src, alt, title, ...rest }) => {
    const resolved = isEcosystemFlowchartRef(src) ? ecosystemFlowchartUrl : src;
    return (
      <img
        {...rest}
        src={resolved}
        alt={alt ?? ""}
        title={title}
        loading="lazy"
        decoding="async"
        style={diagramImgStyle}
      />
    );
  },
  td: ({ children, ...rest }) => (
    <td
      {...rest}
      style={{
        padding: "7px 10px",
        borderBottom: `1px solid rgba(0, 90, 114, 0.22)`,
        color: inkMuted,
        fontWeight: 600,
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  ),
};

function useMarkdownWithBundledEcosystemDiagram(markdown) {
  return useMemo(() => {
    if (!markdown || typeof markdown !== "string") {
      return { mode: "single", body: markdown || "" };
    }

    const stripped = markdown.replace(ECOSYSTEM_MD_IMG, "\n");
    const removed = stripped.length < markdown.length;
    const hIdx = stripped.indexOf(ECOSYSTEM_HEADING);

    if (!removed || hIdx < 0) {
      return { mode: "single", body: stripped };
    }

    const headEnd = hIdx + ECOSYSTEM_HEADING.length;
    const head = stripped.slice(0, headEnd);
    const tail = stripped.slice(headEnd).replace(/^\s*\n+/, "\n");

    return { mode: "split", head, tail };
  }, [markdown]);
}

/**
 * Renders bundled repo markdown (Vite `?raw` imports) with GFM tables, tuned for the help overlay palette.
 * Ecosystem flowchart: `readme_all_jsx_overview.md` may reference `./public/help/salt-ecosystem-flowchart.png` for
 * GitHub; in-app we strip that line and inject the same PNG via `?url` so Sigma/iframes always resolve the asset.
 */
export default function HelpEmbeddedMarkdown({ markdown }) {
  const plan = useMarkdownWithBundledEcosystemDiagram(markdown);

  if (!markdown || typeof markdown !== "string") return null;

  const mdProps = {
    remarkPlugins: [remarkGfm],
    components: mdComponents,
    urlTransform: helpMarkdownUrlTransform,
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {plan.mode === "split" ? (
        <>
          <ReactMarkdown {...mdProps}>{plan.head}</ReactMarkdown>
          <img
            src={ecosystemFlowchartUrl}
            alt="How the ecosystem fits together — Sigma workbook through editorConfig, useSigmaData, App, and components"
            style={diagramImgStyle}
            loading="lazy"
            decoding="async"
          />
          <ReactMarkdown {...mdProps}>{plan.tail}</ReactMarkdown>
        </>
      ) : (
        <ReactMarkdown {...mdProps}>{plan.body}</ReactMarkdown>
      )}
    </div>
  );
}
