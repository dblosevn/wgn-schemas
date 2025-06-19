export default {
  title: "payments",
  version: 0,
  type: "object",
  primaryKey: "id",
  properties: {
    id: { type: "string", maxLength: 20 },
    date: {
      type: ["object", "null"],
      properties: {
        raw: { type: "string" },
        timestamp: { type: ["integer", "null"] }
      },
      required: ["raw", "timestamp"]
    },
    completed: {type: "boolean"},
    clientID: { type: "string" },
    work_number: { type: ["string", "null"] },
    type: { type: "string" },
    description: { type: "string" },
    amount: { type: "number" },
    aaData: {
      type: "array",
      items: { type: "string" }
    },
    details: {
      type: "object",
      properties: {
        flatRate: { type: "boolean" },
        hourly: { type: "boolean" },
        rate: { type: "number" },
        hours: { type: "number" },
        bonus: { type: "number" },
        expenses: { type: "number" },
        messages: [{type: "string"}],
        meta: {
            type: 'object',
            properties: {},
            additionalProperties: true
        },
      },
      additionalProperties: false
    }
  },
  required: [
    "id",
    "date",
    "clientID",
    "type",
    "description",
    "amount",
    "aaData"
  ]
};
