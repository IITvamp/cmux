import { useContext } from "react";
import { TerminalContext } from "../contexts/TerminalContext";

export const useTerminals = () => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error("useTerminals must be used within TerminalProvider");
  }
  return context;
};