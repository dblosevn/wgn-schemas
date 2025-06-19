export default {
    "title": "User Schema",
    "version": 0,
    "description": "describes a user",
    "primaryKey": "username",
    "type": "object",
    "properties": {
        "username": {
            "type": "string",
            maxLength: 100
        },
        "email": {
            "type": "string",
        },
        "name": {
            "type": "string",
        },
        "password": {
            "type": "string",
        },
        "token": {
            "type": "string",
        },
        "alternateEmail": {
            "type": "array",
            "uniqueItems": true,
            "items": {
                "type": "string"
            }
        }
    },
    "required": [
        "username",
        "email",
        "password"
    ]
  }