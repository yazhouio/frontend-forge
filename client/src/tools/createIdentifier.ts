import { DUMMY_SPAN } from "../engine/constants";

export const createIdentifier = (name: string) => {
  return {
    type: "Identifier",
    value: name,
    span: DUMMY_SPAN,
    ctxt: 1,
  };
};
