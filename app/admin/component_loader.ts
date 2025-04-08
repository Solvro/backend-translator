import { ComponentLoader } from "adminjs";

export const componentLoader = new ComponentLoader();

export const Components = {
  TruncatedText: componentLoader.add(
    "TruncatedText",
    "./components/truncated_text",
  ),
};
