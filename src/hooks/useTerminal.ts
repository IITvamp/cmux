import { useEffect, useRef, useState, useCallback } from "react";
import { useTerminals } from "./useTerminals";
import type { TerminalInstance } from "../contexts/TerminalContext";

interface UseTerminalOptions {
  id?: string;
  name?: string;
  autoCreate?: boolean;
  onExit?: () => void;
}

interface UseTerminalReturn {
  terminal: TerminalInstance | undefined;
  terminalId: string | undefined;
  createTerminal: () => string;
  removeTerminal: () => void;
  isReady: boolean;
}

export const useTerminal = (options: UseTerminalOptions = {}): UseTerminalReturn => {
  const { id, name, autoCreate = true, onExit } = options;
  const { terminals, createTerminal: contextCreateTerminal, removeTerminal: contextRemoveTerminal, getTerminal } = useTerminals();
  const [terminalId, setTerminalId] = useState<string | undefined>(id);
  const [isReady, setIsReady] = useState(false);
  const onExitRef = useRef(onExit);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    if (autoCreate && !terminalId) {
      const newId = contextCreateTerminal(undefined, name);
      setTerminalId(newId);
    }
  }, [autoCreate, terminalId, name, contextCreateTerminal]);

  useEffect(() => {
    if (terminalId) {
      const terminal = getTerminal(terminalId);
      setIsReady(!!terminal);
    }
  }, [terminalId, getTerminal]);

  useEffect(() => {
    if (terminalId && !terminals.has(terminalId)) {
      onExitRef.current?.();
      setTerminalId(undefined);
      setIsReady(false);
    }
  }, [terminals, terminalId]);

  const createTerminal = useCallback(() => {
    const newId = contextCreateTerminal(undefined, name);
    setTerminalId(newId);
    return newId;
  }, [contextCreateTerminal, name]);

  const removeTerminal = useCallback(() => {
    if (terminalId) {
      contextRemoveTerminal(terminalId);
      setTerminalId(undefined);
      setIsReady(false);
    }
  }, [terminalId, contextRemoveTerminal]);

  const terminal = terminalId ? getTerminal(terminalId) : undefined;

  return {
    terminal,
    terminalId,
    createTerminal,
    removeTerminal,
    isReady,
  };
};