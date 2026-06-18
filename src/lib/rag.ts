import {
  VectorStoreIndex,
  Settings,
  Document,
  MetadataMode,
  storageContextFromDefaults,
} from "llamaindex";
import { Ollama, OllamaEmbedding } from "@llamaindex/ollama";
import { SentenceSplitter } from "llamaindex";
import fs from "fs";
import path from "path";

const QA_PROMPT = `You are an AI assistant for research documents.
Use ONLY the provided context.
Rules:
- Give direct answers
- Do NOT hallucinate
- If answer not found: say "Information not found in documents."

Context:
----------------
{context}
----------------

Question: {question}

Answer:`;

Settings.llm = new Ollama({
  model: "qwen2.5:3b",
  config: { host: "http://localhost:11434" },
});

Settings.embedModel = new OllamaEmbedding({
  model: "nomic-embed-text",
  config: { host: "http://localhost:11434" },
});

Settings.nodeParser = new SentenceSplitter({
  chunkSize: 200,
  chunkOverlap: 20,
});

const STORE_BASE = "./vector_store";

function getStorePath(projectId: string): string {
  return path.join(STORE_BASE, projectId.replace(/[^a-zA-Z0-9_-]/g, "_"));
}

async function extractPdfText(filePath: string): Promise<string> {
  const { extractText } = await import("unpdf");
  const buffer = fs.readFileSync(filePath);
  const { text } = await extractText(new Uint8Array(buffer));
  return Array.isArray(text) ? text.join("\n") : text;
}

async function extractDocxText(filePath: string): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

function extractExcelText(filePath: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx");
  const workbook = XLSX.readFile(filePath);
  let fullText = "";
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    fullText += `Sheet: ${sheetName}\n${csv}\n\n`;
  }
  return fullText;
}

function extractCsvText(filePath: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Papa = require("papaparse");
  const content = fs.readFileSync(filePath, "utf-8");
  const result = Papa.parse(content, { header: true });
  return (result.data as unknown[])
    .slice(0, 500)
    .map((row) => JSON.stringify(row))
    .join("\n");
}

export async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".txt") return fs.readFileSync(filePath, "utf-8");
  if (ext === ".pdf") return await extractPdfText(filePath);
  if (ext === ".docx") return await extractDocxText(filePath);
  if (ext === ".xlsx" || ext === ".xls") return extractExcelText(filePath);
  if (ext === ".csv") return extractCsvText(filePath);
  throw new Error(`Unsupported file type: ${ext}`);
}

export async function ingestDocument(filePath: string, projectId: string) {
  const fullText = await extractText(filePath);
  if (fullText.trim().length === 0) throw new Error("No text could be extracted");

  const storePath = getStorePath(projectId);
  fs.mkdirSync(storePath, { recursive: true });

  const document = new Document({
    text: fullText,
    metadata: {
      file_name: path.basename(filePath),
      project_id: projectId,
    },
  });

  const ctx = await storageContextFromDefaults({ persistDir: storePath });
  await VectorStoreIndex.fromDocuments([document], { storageContext: ctx });
}

export async function queryDocuments(
  projectId: string,
  question: string
): Promise<string> {
  const storePath = getStorePath(projectId);

  if (!fs.existsSync(path.join(storePath, "vector_store.json"))) {
    return "No documents ingested for this project yet.";
  }

  const ctx = await storageContextFromDefaults({ persistDir: storePath });
  const index = await VectorStoreIndex.init({ storageContext: ctx });
  const retriever = index.asRetriever({ similarityTopK: 3 });
  const nodes = await retriever.retrieve(question);

  if (nodes.length === 0) return "Information not found in documents.";

  const context = nodes
    .map((n) => n.node.getContent(MetadataMode.NONE))
    .join("\n\n");

  const prompt = QA_PROMPT
    .replace("{context}", context)
    .replace("{question}", question);

  const llm = new Ollama({
    model: "qwen2.5:3b",
    config: { host: "http://localhost:11434" },
  });

  const response = await llm.complete({ prompt });
  return response.text;
}