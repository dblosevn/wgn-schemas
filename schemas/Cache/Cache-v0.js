export default {
  title: 'Cache Schema',
  version: 0,
  description: 'Cache Requests Before submitting them.',
  primaryKey: 'guid',
  type: 'object',
  properties: {
    guid: {
      type: 'string',
      maxLength: 100,
    },
    url: {
      type: 'string',
    },
    chunked: {
      type: 'boolean',
    },
    timestamp: {
      type: 'number',
    },
    completed: {
      type: 'number',
    },
    uploaded: {
      type: 'number',
    },
    body: {
      type: 'object',
    },
    files: {
      type: 'object',
    },
    headers: {
      type: 'object',
    },
    status: {
      totalSize: { type: 'number'},
      dismissed: { type: 'boolean'},
      state: { type: 'string'},
      progress: { type: 'number'},
      formCompleted: { type: 'boolean'},
      filesCompleted: { type: 'boolean'}
    }
  },
  attachments: {
    encrypted: false, // if true, the attachment-data will be encrypted with the db-password
  },
  required: ['id', 'guid', 'url'],
}
