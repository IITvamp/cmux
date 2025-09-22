import type { Environment } from "monaco-editor/esm/vs/editor/editor.api";

import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import MarkdownWorker from "monaco-editor/esm/vs/language/markdown/markdown.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

const workerFactories: Record<string, () => Worker> = {
  css: () => new CssWorker(),
  javascript: () => new TsWorker(),
  json: () => new JsonWorker(),
  markdown: () => new MarkdownWorker(),
  scss: () => new CssWorker(),
  typescript: () => new TsWorker(),
  html: () => new HtmlWorker(),
  handlebars: () => new HtmlWorker(),
};

const defaultWorkerFactory = () => new EditorWorker();

const environment: Environment = {
  getWorker(_moduleId, label) {
    const workerFactory = workerFactories[label] ?? defaultWorkerFactory;
    return workerFactory();
  },
};

declare global {
  // eslint-disable-next-line no-var
  var MonacoEnvironment: Environment | undefined;
}

if (typeof globalThis !== "undefined") {
  const shouldInstall = typeof globalThis.MonacoEnvironment === "undefined";
  if (shouldInstall) {
    globalThis.MonacoEnvironment = environment;
  }
}
