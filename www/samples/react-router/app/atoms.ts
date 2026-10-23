// #region context
import type { RequestAtoms } from "raf-effect-atom/react-router";
import { createContext } from "react-router";

// Each server request's registry, set by the root's middleware.
export const atomsContext = createContext<RequestAtoms>();
// #endregion context
