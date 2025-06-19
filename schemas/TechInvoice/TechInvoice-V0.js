export default {
  title: 'Tech Payment Summary',
  description: 'Tracks technician payments with associated assignments',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    username: {
      type: 'string',
      maxLength: 100
    },
    date: {
      type: 'number',
      minimum: 0
    },
    isTechZone: {
      type: 'boolean'
    },
    assignments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            maxLength: 100
          },
          vkey: {
            type: 'string',
            maxLength: 100
          },
          date: {
            type: 'number',
            minimum: 0
          },
          subtotal: {
            type: 'number',
            minimum: 0
          },
          total: {
            type: 'number',
            minimum: 0
          }
        },
        required: ['id', 'vkey', 'date', 'subtotal', 'total']
      },
      // Custom check for uniqueness must be added in code
    },
    total: {
      type: 'number',
      minimum: 0
    }
  },
  required: ['id', 'username', 'date', 'assignments', 'total']
};
