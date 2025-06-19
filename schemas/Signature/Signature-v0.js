export default {
  title: "Signature Schema",
  version: 0,
  description: "describes a signature",
  primaryKey: {
    key: "id",
    fields: ["username", "vkey"],
    separator: "|"
  },
  type: "object",
  properties: {
    id: {
      type: "string",
      maxLength: 200,
    },
    vkey: {
      type: "string",
      maxLength: 100,
    },
    username: {
      type: "string",
      maxLength: 100,
      ref: "users",
    },
    width: { type: "number" },
    height: { type: "number" },
    trimmed: {
      width: { type: "number" },
      height: { type: "number" },
      trimmedDataUrl: { type: "string" },
    },
    original: { type: "string" },
  }
};
