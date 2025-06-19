export default {
  title: "assignments",
  version: 0,
  type: "object",
  primaryKey: "id",
  properties: {
    id: { type: "string", maxLength: 20 },
    clientID: { type: "string" },
    paid_on: {
      type: ["object", "null"],
      properties: {
        raw: { type: "string" },
        timestamp: { type: ["integer", "null"] }
      },
      required: ["raw", "timestamp"]
    },
    scheduled_date: {
      type: "object",
      properties: {
        raw: { type: "string" },
        timestamp: { type: ["integer", "null"] }
      },
      required: ["raw", "timestamp"]
    },
    title_short: { type: "string" },
    location_name: { type: "string" },
    price: { type: "string" },
    city: { type: "string" },
    state: { type: "string" },
    status: { type: "string" },
    is_fast_funded: { type: "boolean" },
    resource: {
      type: "object",
      properties: {
        resourceCompanyId: { type: "integer" }
      },
      required: ["resourceCompanyId"]
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
        messages: [{ type: "string" }],
        meta: {
          type: 'object',
          properties: {},
          additionalProperties: true
        },
      },
      additionalProperties: false
    },
    invoiceID: { type: ["string", "null"], maxLength: 20 },
    techInvoiceID: { type: ["string", "null"], maxLength: 40 }
  },
  required: [
    "id",
    "clientID",
    "scheduled_date",
    "title_short",
    "location_name",
    "price",
    "city",
    "state",
    "status",
    "is_fast_funded",
    "resource"
  ]
};
