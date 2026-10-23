import type { RequestAtoms } from "raf-effect-atom/react-router";
import { createContext } from "react-router";

/** Each server request's registry, set by the root's `atomsMiddleware`. */
export const atomsContext = createContext<RequestAtoms>();
