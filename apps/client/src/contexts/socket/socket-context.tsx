import { createContext } from "react";
import type { SocketContextType } from "./socket-provider";

export const SocketContext = createContext<SocketContextType | null>(null);
