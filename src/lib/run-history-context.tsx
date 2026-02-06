"use client";

import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from "react";
import type { RunRecord } from "./types";

interface RunHistoryState {
  runs: RunRecord[];
  selectedForCompare: [string | null, string | null];
}

type RunHistoryAction =
  | { type: "ADD_RUN"; run: RunRecord }
  | { type: "CLEAR_HISTORY" }
  | {
      type: "SET_COMPARE_SELECTION";
      selection: [string | null, string | null];
    };

const initialState: RunHistoryState = {
  runs: [],
  selectedForCompare: [null, null],
};

function reducer(
  state: RunHistoryState,
  action: RunHistoryAction
): RunHistoryState {
  switch (action.type) {
    case "ADD_RUN":
      return { ...state, runs: [action.run, ...state.runs] };
    case "CLEAR_HISTORY":
      return { ...state, runs: [], selectedForCompare: [null, null] };
    case "SET_COMPARE_SELECTION":
      return { ...state, selectedForCompare: action.selection };
    default:
      return state;
  }
}

const RunHistoryContext = createContext<RunHistoryState>(initialState);
const RunHistoryDispatchContext = createContext<Dispatch<RunHistoryAction>>(
  () => {}
);

export function RunHistoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <RunHistoryContext.Provider value={state}>
      <RunHistoryDispatchContext.Provider value={dispatch}>
        {children}
      </RunHistoryDispatchContext.Provider>
    </RunHistoryContext.Provider>
  );
}

export function useRunHistory() {
  return useContext(RunHistoryContext);
}

export function useRunHistoryDispatch() {
  return useContext(RunHistoryDispatchContext);
}
