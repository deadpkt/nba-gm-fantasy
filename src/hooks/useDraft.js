import { useContext } from "react";
import { DraftContext } from "../context/DraftContext";

export default function useDraft() {
  const context = useContext(DraftContext);
  if (!context) throw new Error("useDraft must be used inside DraftProvider");
  return context;
}
