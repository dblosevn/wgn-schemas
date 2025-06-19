export default {
    title: "invoices",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        id: { type: "string", maxLength: 20 },
        customer: { type: "string" },
        date: { type: "string" },         // Consider using timestamp if needed
        dueDate: { type: "string" },      // Same here
        clientID: { type: "string" },
        gross: { type: "number" },
        fees: { type: "number" },
        total: { type: "number" },
        lines: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    product: { type: "string" },
                    description: { type: "string" },
                    amount: { type: "number" }
                },
                required: ["product", "description", "amount"]
            }
        }
    },
    required: [
        "id",
        "customer",
        "date",
        "dueDate",
        "clientID",
        "gross",
        "fees",
        "total",
        "lines"
    ]
};
